
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
    if (a < b) {
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

