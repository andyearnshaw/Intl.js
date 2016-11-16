const realDefineProp = (function () {
        let sentinel = function(){};
        try {
            Object.defineProperty(sentinel, 'a', {
                get: function () {
                    return 1;
                }
            });
            Object.defineProperty(sentinel, 'prototype', { writable: false });
            return sentinel.a === 1 && sentinel.prototype instanceof Object;
        } catch (e) {
            return false;
        }
    })();

// Need a workaround for getters in ES3
export const es3 = !realDefineProp && !Object.prototype.__defineGetter__;

// We use this a lot (and need it for proto-less objects)
export const hop = Object.prototype.hasOwnProperty;

// Naive defineProperty for compatibility
export const defineProperty = realDefineProp ? Object.defineProperty : function (obj, name, desc) {
    if ('get' in desc && obj.__defineGetter__)
        obj.__defineGetter__(name, desc.get);

    else if (!hop.call(obj, name) || 'value' in desc)
        obj[name] = desc.value;
};

// Array.prototype.indexOf, as good as we need it to be
export const arrIndexOf = Array.prototype.indexOf || function (search) {
    /*jshint validthis:true */
    let t = this;
    if (!t.length)
        return -1;

    for (let i = arguments[1] || 0, max = t.length; i < max; i++) {
        if (t[i] === search)
            return i;
    }

    return -1;
};

// Create an object with the specified prototype (2nd arg required for Record)
export const objCreate = Object.create || function (proto, props) {
    let obj;

    function F() {}
    F.prototype = proto;
    obj = new F();

    for (let k in props) {
        if (hop.call(props, k))
            defineProperty(obj, k, props[k]);
    }

    return obj;
};

// Snapshot some (hopefully still) native built-ins
export const arrSlice  = Array.prototype.slice;
export const arrConcat = Array.prototype.concat;
export const arrPush   = Array.prototype.push;
export const arrJoin   = Array.prototype.join;
export const arrShift  = Array.prototype.shift;

// Naive Function.prototype.bind for compatibility
export const fnBind = Function.prototype.bind || function (thisObj) {
    let fn = this,
        args = arrSlice.call(arguments, 1);

    // All our (presently) bound functions have either 1 or 0 arguments. By returning
    // different function signatures, we can pass some tests in ES3 environments
    if (fn.length === 1) {
        return function () {
            return fn.apply(thisObj, arrConcat.call(args, arrSlice.call(arguments)));
        };
    }
    return function () {
        return fn.apply(thisObj, arrConcat.call(args, arrSlice.call(arguments)));
    };
};

// Object housing internal properties for constructors
export const internals = objCreate(null);

// Keep internal properties internal
export const secret = Math.random();

// Helper functions
// ================

/**
 * A function to deal with the inaccuracy of calculating log10 in pre-ES6
 * JavaScript environments. Math.log(num) / Math.LN10 was responsible for
 * causing issue #62.
 */
export function log10Floor (n) {
    // ES6 provides the more accurate Math.log10
    if (typeof Math.log10 === 'function')
        return Math.floor(Math.log10(n));

    let x = Math.round(Math.log(n) * Math.LOG10E);
    return x - (Number('1e' + x) > n);
}

/**
 * A map that doesn't contain Object in its prototype chain
 */
export function Record (obj) {
    // Copy only own properties over unless this object is already a Record instance
    for (let k in obj) {
        if (obj instanceof Record || hop.call(obj, k))
            defineProperty(this, k, { value: obj[k], enumerable: true, writable: true, configurable: true });
    }
}
Record.prototype = objCreate(null);

/**
 * An ordered list
 */
export function List() {
    defineProperty(this, 'length', { writable:true, value: 0 });

    if (arguments.length)
        arrPush.apply(this, arrSlice.call(arguments));
}
List.prototype = objCreate(null);

/**
 * Constructs a regular expression to restore tainted RegExp properties
 */
export function createRegExpRestore () {
    if (internals.disableRegExpRestore) {
        return function() { /* no-op */ };
    }

    let regExpCache = {
            lastMatch: RegExp.lastMatch || '',
            leftContext: RegExp.leftContext,
            multiline: RegExp.multiline,
            input: RegExp.input
        },
        has = false;

    // Create a snapshot of all the 'captured' properties
    for (let i = 1; i <= 9; i++)
        has = (regExpCache['$'+i] = RegExp['$'+i]) || has;

    return function() {
        // Now we've snapshotted some properties, escape the lastMatch string
        let esc = /[.?*+^$[\]\\(){}|-]/g,
            lastMatch = regExpCache.lastMatch.replace(esc, '\\$&'),
            exprStr = '';

        // If any of the captured strings were non-empty, iterate over them all
        if (has) {
            for (let i = 1; i <= 9; i++) {
                let m = regExpCache['$'+i];

                // If it's empty, add an empty capturing group
                if (!m) {
                    exprStr += '(';
                    lastMatch = ')' + lastMatch;
                }
                // Else find the string in lm and escape & wrap it to capture it
                else {
                    m = m.replace(esc, '\\$&');
                    exprStr += lastMatch.substring(0, lastMatch.indexOf(m)) + '(';
                    lastMatch = m + ')' + lastMatch.substring(lastMatch.indexOf(m) + m.length);
                }
            }
        }

        exprStr += lastMatch;

        // Shorten the regex by replacing each part of the expression with a match
        // for a string of that exact length.  This is safe for the type of
        // expressions generated above, because the expression matches the whole
        // match string, so we know each group and each segment between capturing
        // groups can be matched by its length alone.
        //
        // The purpose of the regex is to match sequences of characters other
        // than unescaped parentheses.  This is a more complicated requirement
        // than it seems at first glance, because it's necessary to match a
        // parenthesis which appears immediately after a backslash ("\("), but
        // not a parenthesis which appears immediately after an escaped backslash
        // ("\\(").  We can't simply match [^\\]\\(, because the previous
        // backslash could itself have a backslash preceding (and escaping) it.
        //
        // Any attempts to simplify this regex are encouraged!  A replacement
        // regex should match the strings "a\\\(\\\)\\" and "a\\\)\\\(" in the
        // test string "a\\\(\\\)\\(a\\\)\\\()".
        exprStr = exprStr.replace(/((^|[^\\])((\\\\)*\\[()])+|[^()])+/g, (match) => {
            return `[\\s\\S]{${match.replace(/\\(.)/g, '$1').length}}`;
        });

        // Create the regular expression that will reconstruct the RegExp properties
        let expr = new RegExp(exprStr, regExpCache.multiline ? 'gm' : 'g');

        // Set the lastIndex of the generated expression to ensure that the match
        // is found in the correct index.
        expr.lastIndex = regExpCache.leftContext.length;

        expr.exec(regExpCache.input);
    };
}

/**
 * Mimics ES5's abstract ToObject() function
 */
export function toObject (arg) {
    if (arg === null)
        throw new TypeError('Cannot convert null or undefined to object');

    if (typeof arg === 'object')
        return arg;
    return Object(arg);
}

export function toNumber (arg) {
    if (typeof arg === 'number')
        return arg;
    return Number(arg);
}

export function toInteger (arg) {
  let number = toNumber(arg);
  if (isNaN(number))
      return 0;
  if (number === +0 ||
      number === -0 ||
      number === +Infinity ||
      number === -Infinity)
      return number;
  if (number < 0)
      return Math.floor(Math.abs(number)) * -1;
  return Math.floor(Math.abs(number));
}

export function toLength (arg) {
  let len = toInteger(arg);
  if (len <= 0)
      return 0;
  if (len === Infinity)
      return Math.pow(2, 53) - 1;
  return Math.min(len, Math.pow(2, 53) - 1);
}

/**
 * Returns "internal" properties for an object
 */
export function getInternalProperties (obj) {
    if (hop.call(obj, '__getInternalProperties'))
        return obj.__getInternalProperties(secret);

    return objCreate(null);
}
