
function processIssues(issues) {

    if (issues.length < 1) {
        return;
    }

    var issue = issues[0];

    var activity = analyzeActivity(issue);

    timelineTable.bootstrapTable('load', activity.timeline);
    workTable.bootstrapTable('load', activity.work);

    var summary = {
        issue: issue.key,
        summary: issue.fields.summary,
        timeEstimate: issue.fields.aggregatetimeoriginalestimate,
        timeSpent: issue.fields.aggregatetimespent,
    };

    summaryTable.bootstrapTable('load', [summary]);
}

function formatTimestamp(value) {
   // I cannot believe there are no normal date formatting methods and I need to either use additional libraries
   // or do it manually...
   //   https://stackoverflow.com/questions/3552461/how-to-format-a-javascript-date
   // Neither there is string formatting or padding. My god, what a language.
   return ''
       + value.getFullYear().toString().padStart(4, '0')
       + '-'
       + (value.getMonth() + 1).toString().padStart(2, '0')
       + '-'
       + value.getDate().toString().padStart(2, '0')
       + ' '
       + value.getHours().toString().padStart(2, '0')
       + ':'
       + value.getMinutes().toString().padStart(2, '0')
       + ':'
       + value.getSeconds().toString().padStart(2, '0');
}


// https://docs.atlassian.com/jira/REST/latest/


async function loadIssue() {

    var issue = $('#issue').val();
    if (!issue) {
        return;
    }

    window.location.hash = issue;

    timelineTable.bootstrapTable('showLoading');
    workTable.bootstrapTable('showLoading');
    summaryTable.bootstrapTable('showLoading');

    await authenticate();

    var issues = await searchIssues({
//        jql: "assignee in membersOf('" + GROUP + "')",
        jql: "key = '" + issue + "'",
        fields: "summary,assignee,status,priority,updated,worklog,aggregatetimeoriginalestimate,aggregatetimespent",
        expand: "changelog",
    });

    processIssues(issues);

    summaryTable.bootstrapTable('hideLoading');
    workTable.bootstrapTable('hideLoading');
    timelineTable.bootstrapTable('hideLoading');
}

var timelineTable;

function initTimelineTable() {
    timelineTable = $('#timeline');
    timelineTable.bootstrapTable({
    });
}

var workTable;

function initWorkTable() {
    workTable = $('#work');
    workTable.bootstrapTable({
    });
}

var sumaryTable;

function initSummaryTable() {
    summaryTable = $('#summary');
    summaryTable.bootstrapTable({
    });
}

// Init tables and load data
$(function () {

    var issue = location.hash.substr(1);
    $('#issue').val(issue);

    initTimelineTable();
    initWorkTable();
    initSummaryTable();

    loadIssue();
});

