
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

// A separate cell style method for each of the count columns.
// I wanted to have just one method that reads attributes from the column to know
// what are warning/danger levels for this particular counter but it looks like data-cell-style function
// does not receive data about column it is applied to... So here we go with bunch of identical methods
// with different limits

function countCellStyle_InProgress(value, row, index) {
    return countCellStyle1(row.person, 'InProgress', {warn: {count: 5, age: 7}, danger: {count: 10, age: 14}});
}

function countCellStyle_InReview(value, row, index) {
    return countCellStyle1(row.person, 'InReview', {warn: {count: 3, age: 2}, danger: {count: 5, age: 7}});
}

function countCellStyle_InTest(value, row, index) {
    return countCellStyle1(row.person, 'InTest', {warn: {count: 3, age: 3}, danger: {count: 5, age: 14}});
}

function countCellStyle_Closed(value, row, index) {
    return countCellStyle1(row.person, 'Closed', {warn: {count: 1}, danger: {count: 3, age: 5}});
}

function countCellStyle_Blocked(value, row, index) {
    return countCellStyle1(row.person, 'Blocked', {warn: {count: 3, age: 7}, danger: {count: 5, age: 14}});
}

function countCellStyle_Other(value, row, index) {
    return countCellStyle1(row.person, 'Other', {warn: {count: 10, age: 14}, danger: {count: 15, age: 30}});
}

// options is in this format {warn: {count: 3, age: 3}, danger: {count: 5, age: 14}}
// where age is in days
function countCellStyle1(person, status, options) {
    var issues = filterIssues(person, status);
    var result;

    if (checkViolations(issues, options.danger)) {
        result = "danger";
    } else if (checkViolations(issues, options.warn)) {
        result = "warning";
    }

    return { classes: result };
}

// condition = {count: 3, age: 3}
function checkViolations(issues, condition) {
    if (condition == null) {
        return false;
    }

    var lastUpdated = oldestUpdate(issues);
    var age = lastUpdated != null ? (new Date() - lastUpdated) / (1000 * 60 * 60 * 24) : null;

    if (condition.count != null && issues.length >= condition.count) {
        return true;
    } else if (condition.age != null && age != null && age >= condition.age) {
        return true;
    } else {
        return false;
    }
}

function oldestUpdate(issues) {
    // TODO: replace with reduce()
    var result = null;
    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];
        if (result == null || result > issue.lastUpdated) {
            result = issue.lastUpdated;
        }
    }

    return result;
}

function formatDate(value, row, index) {
   // I cannot believe there are no normal date formatting methods and I need to either use additional libraries
   // or do it manually...
   //   https://stackoverflow.com/questions/3552461/how-to-format-a-javascript-date
   // Neither there is string formatting or padding. My god, what a language.
   return ''
       + value.getFullYear().toString().padStart(4, '0')
       + '-'
       + (value.getMonth() + 1).toString().padStart(2, '0')
       + '-'
       + value.getDate().toString().padStart(2, '0');
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

function filterIssues(person, status) {
    var issues = issuesData;

    if (person) {
        issues = issues.filter(function(i) { return i.assignee == person; });
    }

    if (status != 'total') {
        issues = issues.filter(function(i) { return issueStatusCode(i.status) == status; });
    }

    return issues;
}

function showDetails(person, status) {
    var issues = filterIssues(person, status);
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
            lastUpdated: new Date(issue.fields.updated),
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
        fields: "summary,assignee,status,priority,updated"
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

