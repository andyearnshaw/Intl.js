const realDefineProp = (function () {
        let sentinel = {};
        try {
            Object.defineProperty(sentinel, 'a', {});
            return 'a' in sentinel;
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
    let esc = /[.?*+^$[\]\\(){}|-]/g,
        lm  = RegExp.lastMatch || '',
        ml  = RegExp.multiline ? 'm' : '',
        ret = { input: RegExp.input },
        reg = new List(),
        has = false,
        cap = {};

    // Create a snapshot of all the 'captured' properties
    for (let i = 1; i <= 9; i++)
        has = (cap['$'+i] = RegExp['$'+i]) || has;

    // Now we've snapshotted some properties, escape the lastMatch string
    lm = lm.replace(esc, '\\$&');

    // If any of the captured strings were non-empty, iterate over them all
    if (has) {
        for (let i = 1; i <= 9; i++) {
            let m = cap['$'+i];

            // If it's empty, add an empty capturing group
            if (!m)
                lm = '()' + lm;

            // Else find the string in lm and escape & wrap it to capture it
            else {
                m = m.replace(esc, '\\$&');
                lm = lm.replace(m, '(' + m + ')');
            }

            // Push it to the reg and chop lm to make sure further groups come after
            arrPush.call(reg, lm.slice(0, lm.indexOf('(') + 1));
            lm = lm.slice(lm.indexOf('(') + 1);
        }
    }

    // Create the regular expression that will reconstruct the RegExp properties
    ret.exp = new RegExp(arrJoin.call(reg, '') + lm, ml);

    return ret;
}

/**
 * Mimics ES5's abstract ToObject() function
 */
export function toObject (arg) {
    if (arg === null)
        throw new TypeError('Cannot convert null or undefined to object');

    return Object(arg);
}

/**
 * Returns "internal" properties for an object
 */
export function getInternalProperties (obj) {
    if (hop.call(obj, '__getInternalProperties'))
        return obj.__getInternalProperties(secret);

    return objCreate(null);
}
