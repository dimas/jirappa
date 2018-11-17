
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

    var issues = person.issues.filter(function(i) { return issueStatusCode(i.status) == status; });

    detailsTable.bootstrapTable('load', issues);

    $("#myModal").modal({keyboard: true});
}

function initDetailsTable() {
    detailsTable = $('#details');
    detailsTable.bootstrapTable({
    });
}

var statesTable;

var peopleData;

function initStatesTable() {
    statesTable = $('#states');
    statesTable.bootstrapTable({
    });

    statesTable.on("click", "a", function(event) {
        event.preventDefault();
        showDetails($(event.target).attr("person"), $(event.target).attr("status"));
    });
}

function issueStatusCode(status) {
    var status = status.replace(' ', '');
    if (status == 'Closed' || status == 'InTest' || status == 'InReview') {
        return status;
    } else {
        return 'Other';
    }
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
            var status = issueStatusCode(issue.status);
            counts[status] |= 0;
            counts[status] += 1;
            total++;
        }

        tableItems.push({
                person: personData.person,
                counts: counts,
                total: total,
        });

    }

    peopleData = data;
    statesTable.bootstrapTable('load', tableItems);
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
/*
    // Here is some test data (comment out call to loadStates() when uncommenting this)
    processStatesIssues([
        {key: 'ISSUE-1', fields: {summary: 'The one that is closed', assignee: {displayName: 'Sarah Smith'}, status: {name: 'Closed'}}},
        {key: 'ISSUE-2', fields: {summary: 'The one that is open', assignee: {displayName: 'Bob Reckless'}, status: {name: 'Open'}}},
        {key: 'ISSUE-3', fields: {summary: 'The blocked one', assignee: {displayName: 'Bob Reckless'}, status: {name: 'Blocked'}}},
        {key: 'ISSUE-4', fields: {summary: 'In review forever', assignee: {displayName: 'Percy Glasses'}, status: {name: 'In Review'}}},
        {key: 'ISSUE-5', fields: {summary: 'Analysis required', assignee: {displayName: 'Kim Goodenough'}, status: {name: 'In Analysis'}}},
        {key: 'ISSUE-6', fields: {summary: 'To be verified', assignee: {displayName: 'Jay Careful'}, status: {name: 'In Test'}}},
    ]);
*/
});

