const CamelPattern = /^\w|[A-Z]|\b\w/g;
const CamelSplitPattern = /([a-z\d])([A-Z])/g;
const IllegalCamelPattern = /[\s\W]+/g;

let uniqueIDs = new Map();

function autoIncrement(string) {
    let count = uniqueIDs.get(string);
    let result = string;

    if (count !== undefined) {
        count++;
        result = string + count;
    } else {
        count = 0;
    }

    uniqueIDs.set(string, count);

    return result;
}

function adjustCase(word, index) {
    return index === 0 ? word.toLowerCase() : word.toUpperCase();
}

export function camelCase(value) {
    return String(value)
        .replace(CamelPattern, adjustCase)
        .replace(IllegalCamelPattern, "");
}

export function uniqueKey(value, maxLength = 32) {
    let result = camelCase(value);

    if (maxLength && result.length > maxLength) {
        let length = 0;

        // split the camelCased string between lower and uppercase letters, then
        // keep adding those words until the length > maxLength
        result = result
            .replace(CamelSplitPattern, "$1 $2")
            .split(" ")
            .filter((word) => {
                length += word.length;

                return length <= maxLength;
            })
            .join("");
    }

    result = autoIncrement(result);

    return result;
}

export function createUniqueKeyFn() {
    const uniqueIDs = new Map();

    function autoIncrement(string) {
        let count = uniqueIDs.get(string);
        let result = string;

        if (count !== undefined) {
            count++;
            result = string + count;
        } else {
            count = 0;
        }

        uniqueIDs.set(string, count);

        return result;
    }

    return function uniqueKey(value, maxLength = 32) {
        let result = camelCase(value);

        if (maxLength && result.length > maxLength) {
            let length = 0;

            // split the camelCased string between lower and uppercase letters, then
            // keep adding those words until the length > maxLength
            result = result
                .replace(CamelSplitPattern, "$1 $2")
                .split(" ")
                .filter((word) => {
                    length += word.length;

                    return length <= maxLength;
                })
                .join("");
        }

        result = autoIncrement(result);

        return result;
    };
}
