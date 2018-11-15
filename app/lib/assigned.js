
function totalLabelFooterFormatter(data) {
    return 'TOTAL';
}

function sumFooterFormatter(data) {
    var field = this.field;

    return data.reduce(
        function(sum, row) {
            return (sum) + (getField(row, field) || 0);
        },
        0);
}

function statesFooterStyle(value, row, index) {
    return {
        css: { "font-weight": "bold", "text-align": "right" }
    };
}

function totalCellStyle(value, row, index) {
    // Despite this function is only assigned to the "total" column, the third column of the table (whatever status ends up there) gets it applied too.
    // I believe this is because "total" is the third column in the original table so bootstrap somehow binds these functions even before
    // we invoke destroy() and reload the table.
    // Because of that - do not allow this style to be applied to wrong columns
    if (this.field != 'total') {
        return {};
    }

    return { css: {"text-align": "right"} };
}

function formatIssueCount(value, row, index) {
    status = this.field.replace(/^counts\./, '');
    return '<a href="#" person="' + escapeText(row.person) + '" + status="' + escapeText(status) + '">' + escapeText(value) + '</a>';
}

// Extractor gets value for a field.
// Super simplified implementation of https://github.com/wenzhixin/bootstrap-table/blob/7b6a3342d5ac32735ed44318a66a8292ac2e0fa1/src/bootstrap-table.js#L243
function getField(item, field) {
     let value = item;
     for (const p of field.split('.')) {
         value = value && value[p];
     }
     return value;
}

var detailsTable;

function showDetails(person, status) {
    person = peopleData[person];

    var issues = person.issues.filter(function(i) { return i.status == status; });

    detailsTable.bootstrapTable('load', issues);

    $("#myModal").modal({keyboard: true});
}

function initDetailsTable() {
    detailsTable = $('#details');
    detailsTable.bootstrapTable({
    });
}

var statesTable;
var columnsTemplate;
var templateColumnIndex;
var peopleData;

function initStatesTable() {
    statesTable = $('#states');
    statesTable.bootstrapTable({
    });

    // Not sure why 'columns' is multi-dimensionalarray but...
    columnsTemplate = statesTable.bootstrapTable('getOptions').columns[0];

    for (var i = 0; i < columnsTemplate.length; i++) {
        if (columnsTemplate[i].field == "count"){
            templateColumnIndex = i;
        }
    }

    statesTable.on("click", "a", function(event) {
        event.preventDefault();
        showDetails($(event.target).attr("person"), $(event.target).attr("status"));
    });
}

function renderStatesTable(issues) {

    var states = {};
    var data = {};

    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];
        var person = issue.fields.assignee.displayName;
        var status = issue.fields.status.name;

        var personData = data[person];
        if (personData == null) {
            personData = data[person] = { 
                person: person,
                issues: [],
            };
        }

        personData.issues.push({
            issue: issue.key,
            status: status,
            issueSummary: issue.fields.summary,
        });

        states[status] = true;
    }

    states = Object.keys(states).sort();

    var tableItems = [];

    var people = Object.keys(data);
    for (i = 0; i < people.length; i++) {
        var person = people[i];

        var personData = data[person];

        var counts = {};
        var total = 0;
        for (j = 0; j < personData.issues.length; j++) {
            var issue = personData.issues[j];
            counts[issue.status] |= 0;
            counts[issue.status] += 1;
            total++;
        }

        tableItems.push({
                person: personData.person,
                counts: counts,
                total: total,
        });

    }

    cols = [];
    add(cols, columnsTemplate);

    templateColumn = columnsTemplate[templateColumnIndex];
    cols.splice(templateColumnIndex, 1);

    for (i = 0; i < states.length; i++) {
        // clone template column
        column = $.extend(true, {}, templateColumn);
        // update copy
        column.field = "counts." + states[i];
        column.title = states[i];

        cols.splice(templateColumnIndex++, 0, column);
    }

    peopleData = data;

    statesTable.bootstrapTable('destroy').bootstrapTable({
        columns: cols,
        data: tableItems
    });
}

function processStatesIssues(issues) {
    renderStatesTable(issues);
}

async function loadStates() {

    statesTable.bootstrapTable('showLoading');

    await authenticate();

    var issues = await searchIssues({
        jql: "assignee in membersOf('" + GROUP + "')",
        fields: "summary,assignee,status,parent"
    });

    processStatesIssues(issues);

    statesTable.bootstrapTable('hideLoading');
}


// Init tables and load data
$(function () {
    initDetailsTable();
    initStatesTable();

    loadStates();

//    processStatesIssues([{fields: {assignee: 'a person', status: {name: 'a status'}}}]);

});

