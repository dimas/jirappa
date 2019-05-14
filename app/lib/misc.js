
// For debuging purposes
function saveJson(data, filename){
    var a = document.createElement('a');
    a.setAttribute('href', 'data:application/json;charset=utf-u,' + encodeURIComponent(JSON.stringify(data)));
    a.setAttribute('download', filename);
    a.setAttribute("style", "display: none")
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// Return an array of hash values
function values(hash) {
    var keys = Object.keys(hash);
    var result = [];
    for (var i = 0; i < keys.length; i++) {
        result.push(hash[keys[i]]);
    }
    return result;
}

function compare(a, b) {
    if (a == null) {
        return b == null ? 0 : 1;
    } else if (b == null) {
        return -1;
    } else if (a < b) {
        return -1;
    } else if (a > b) { 
        return 1;
    } else {
        return 0;
    }
}

// Add all items from the 'source' array into the 'target'
function add(target, source) {
    for (var i = 0; i < source.length; i++) {
        target.push(source[i]);
    }
}

function escapeText(text) {
    if (!text) {
        return '';
    }

    text = text + '';

    return text.replace( /['"<>&]/g,
        function(c) {
            switch (c) {
                case "'": return "&#039;";
		case '"': return "&quot;";
		case "<": return "&lt;";
		case ">": return "&gt;";
		case "&": return "&amp;";
            }
	}
     );
}


// Date and time formatting
// I cannot believe there are no normal date formatting methods and I need to either use additional libraries
// or do it manually...
//   https://stackoverflow.com/questions/3552461/how-to-format-a-javascript-date
// Neither there is string formatting or padding. My god, what a language.

function padNum(value, width) {
    return value.toString().padStart(width, '0');
}

// Formats date from a Date object as 'YYYY-DD-MM'
//
function isoDate(value) {
    return ''
        + padNum(value.getFullYear(), 4)
        + '-'
        + padNum(value.getMonth() + 1, 2)
        + '-'
        + padNum(value.getDate(), 2);
}

// Formats time from a Date object as 'HH:MM:SS'
//
function isoTime(value) {
    return ''
        + padNum(value.getHours(), 2)
        + ':'
        + padNum(value.getMinutes(), 2)
        + ':'
        + padNum(value.getSeconds(), 2);
}

