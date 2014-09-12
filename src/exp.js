/* jshint esnext: true, laxbreak:true */

/**
* Defines regular expressions for various operations related to the BCP 47 syntax,
* as defined at http://tools.ietf.org/html/bcp47#section-2.1
*/

var
    // extlang       = 3ALPHA              ; selected ISO 639 codes
    //                 *2("-" 3ALPHA)      ; permanently reserved
    extlang = '[a-z]{3}(?:-[a-z]{3}){0,2}',

    // language      = 2*3ALPHA            ; shortest ISO 639 code
    //                 ["-" extlang]       ; sometimes followed by
    //                                     ; extended language subtags
    //               / 4ALPHA              ; or reserved for future use
    //               / 5*8ALPHA            ; or registered language subtag
    language = '(?:[a-z]{2,3}(?:-' + extlang + ')?|[a-z]{4}|[a-z]{5,8})',

    // script        = 4ALPHA              ; ISO 15924 code
    script = '[a-z]{4}',

    // region        = 2ALPHA              ; ISO 3166-1 code
    //               / 3DIGIT              ; UN M.49 code
    region = '(?:[a-z]{2}|\\d{3})',

    // variant       = 5*8alphanum         ; registered variants
    //               / (DIGIT 3alphanum)
    variant = '(?:[a-z0-9]{5,8}|\\d[a-z0-9]{3})',

    //                                     ; Single alphanumerics
    //                                     ; "x" reserved for private use
    // singleton     = DIGIT               ; 0 - 9
    //               / %x41-57             ; A - W
    //               / %x59-5A             ; Y - Z
    //               / %x61-77             ; a - w
    //               / %x79-7A             ; y - z
    singleton = '[0-9a-wy-z]',

    // extension     = singleton 1*("-" (2*8alphanum))
    extension = singleton + '(?:-[a-z0-9]{2,8})+',

    // privateuse    = "x" 1*("-" (1*8alphanum))
    privateuse = 'x(?:-[a-z0-9]{1,8})+',

    // irregular     = "en-GB-oed"         ; irregular tags do not match
    //               / "i-ami"             ; the 'langtag' production and
    //               / "i-bnn"             ; would not otherwise be
    //               / "i-default"         ; considered 'well-formed'
    //               / "i-enochian"        ; These tags are all valid,
    //               / "i-hak"             ; but most are deprecated
    //               / "i-klingon"         ; in favor of more modern
    //               / "i-lux"             ; subtags or subtag
    //               / "i-mingo"           ; combination
    //               / "i-navajo"
    //               / "i-pwn"
    //               / "i-tao"
    //               / "i-tay"
    //               / "i-tsu"
    //               / "sgn-BE-FR"
    //               / "sgn-BE-NL"
    //               / "sgn-CH-DE"
    irregular = '(?:en-GB-oed'
              + '|i-(?:ami|bnn|default|enochian|hak|klingon|lux|mingo|navajo|pwn|tao|tay|tsu)'
              + '|sgn-(?:BE-FR|BE-NL|CH-DE))',

    // regular       = "art-lojban"        ; these tags match the 'langtag'
    //               / "cel-gaulish"       ; production, but their subtags
    //               / "no-bok"            ; are not extended language
    //               / "no-nyn"            ; or variant subtags: their meaning
    //               / "zh-guoyu"          ; is defined by their registration
    //               / "zh-hakka"          ; and all of these are deprecated
    //               / "zh-min"            ; in favor of a more modern
    //               / "zh-min-nan"        ; subtag or sequence of subtags
    //               / "zh-xiang"
    regular = '(?:art-lojban|cel-gaulish|no-bok|no-nyn'
            + '|zh-(?:guoyu|hakka|min|min-nan|xiang))',

    // grandfathered = irregular           ; non-redundant tags registered
    //               / regular             ; during the RFC 3066 era
    grandfathered = '(?:' + irregular + '|' + regular + ')',

    // langtag       = language
    //                 ["-" script]
    //                 ["-" region]
    //                 *("-" variant)
    //                 *("-" extension)
    //                 ["-" privateuse]
    langtag = language + '(?:-' + script + ')?(?:-' + region + ')?(?:-'
            + variant + ')*(?:-' + extension + ')*(?:-' + privateuse + ')?';

// Language-Tag  = langtag             ; normal language tags
//               / privateuse          ; private use tag
//               / grandfathered       ; grandfathered tags
export var expBCP47Syntax = RegExp('^(?:'+langtag+'|'+privateuse+'|'+grandfathered+')$', 'i');

// Match duplicate variants in a language tag
export var expVariantDupes = RegExp('^(?!x).*?-('+variant+')-(?:\\w{4,8}-(?!x-))*\\1\\b', 'i');

// Match duplicate singletons in a language tag (except in private use)
export var expSingletonDupes = RegExp('^(?!x).*?-('+singleton+')-(?:\\w+-(?!x-))*\\1\\b', 'i');

// Match all extension sequences
export var expExtSequences = RegExp('-'+extension, 'ig');
