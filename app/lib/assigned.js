
function totalLabelFooterFormatter(data) {
    return 'TOTAL';
}

function sumFooterFormatter(data) {
    var field = this.field;
    status = this.field.replace(/^counts\./, '');

    var total = data.reduce(
        function(sum, row) {
            return (sum) + (getField(row, field) || 0);
        },
        0);

    return '<a href="#" data-type="issue-count" status="' + escapeText(status) + '">' + total + '</a>';
}

function statesFooterStyle(value, row, index) {
    return {
        css: { "font-weight": "bold", "text-align": "right" }
    };
}

function totalCellStyle(value, row, index) {
    return { css: {"text-align": "right"} };
}

function formatIssueCount(value, row, index) {
    status = this.field.replace(/^counts\./, '');
    return '<a href="#" data-type="issue-count" person="' + escapeText(row.person) + '" status="' + escapeText(status) + '">' + escapeText(value) + '</a>';
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
    var issues = issuesData;

    if (person) {
        issues = issues.filter(function(i) { return i.assignee == person; });
    }

    if (status != 'total') {
        issues = issues.filter(function(i) { return issueStatusCode(i.status) == status; });
    }

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

var issuesData;

function initStatesTable() {
    statesTable = $('#states');
    statesTable.bootstrapTable({
    });

    // Apparently, the footer is not part of the table - it is not a normal <tr> there
    // but is sitting in a completely different <div> and a separate table there.
    // So go a couple parents up in order to bind an event to both table cells and footer cells
    $(statesTable).parent().parent().on("click", "a[data-type=issue-count]", function(event) {
        event.preventDefault();
        showDetails($(event.target).attr("person"), $(event.target).attr("status"));
    });

}

function issueStatusCode(status) {
    var status = status.replace(' ', '');
    if (status == 'InProgress' || status == 'Closed' || status == 'InTest' || status == 'InReview' || status == 'Blocked') {
        return status;
    } else {
        return 'Other';
    }
}

function renderStatesTable(issues) {

    var data = {};

    issuesData = [];

    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];
        var person = issue.fields.assignee.displayName;
        var status = issue.fields.status.name;

        var personData = data[person];
        if (personData == null) {
            personData = data[person] = { 
                person: person,
                statusCount: {},
                totalCount: 0,
            };
        }

        var statusCode = issueStatusCode(status);
        personData.statusCount[statusCode] |= 0;
        personData.statusCount[statusCode] += 1;
        personData.totalCount++;

        issuesData.push({
            issue: issue.key,
            status: status,
            assignee: person,
            issuePriority: issue.fields.priority ? {name: issue.fields.priority.name, iconUrl: issue.fields.priority.iconUrl} : null,
            issueSummary: issue.fields.summary,
        });
    }

    var tableItems = [];

    var people = Object.keys(data);
    for (i = 0; i < people.length; i++) {
        var person = people[i];

        var personData = data[person];

        tableItems.push({
                person: personData.person,
                counts: personData.statusCount,
                total: personData.totalCount,
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
        fields: "summary,assignee,status,priority"
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

