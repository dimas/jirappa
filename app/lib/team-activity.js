
function formatPresentDuration(seconds) {
    return seconds ? formatDuration(seconds) : '';
}

function activitySorter(a, b) {
    return compare(a.timeSpent, b.timeSpent);
}

function formatActivity(value, row, index) {
    if (value.ticketCount < 1) {
        return '';
    }

    return formatDuration(value.timeSpent) + ' (<a href="#" data-type="issue-count" person="' + escapeText(row.person) + '" activity="' + this.field + '">' + escapeText(value.ticketCount) + '</a>)';
}

function addWork(item, timeSpent) {
    item.ticketCount++;
    item.timeSpent += timeSpent;
}

var activities;

function processIssues(issues) {

    activities = [];

    var peopleData = {};

    issues.forEach(function(issue) {
        var activity = analyzeActivity(issue, startTime, endTime);
        activities.push(activity);
        activity.work.forEach(function(work) {
            var personData = peopleData[work.person];
            if (!personData) {
                personData = peopleData[work.person] = {
                    person: work.person,
                    total: {
                        timeSpent: 0,
                        ticketCount: 0
                    },
                    development: {
                        timeSpent: 0,
                        ticketCount: 0
                    },
                    review: {
                        timeSpent: 0,
                        ticketCount: 0
                    },
                    testing: {
                        timeSpent: 0,
                        ticketCount: 0
                    }
                };
            }

            addWork(personData.total, work.timeSpent);

            if (work.activity == "developer") {
                addWork(personData.development, work.timeSpent);
            } else if (work.activity == "reviewer") {
                addWork(personData.review, work.timeSpent);
            } else if (work.activity == "tester") {
                addWork(personData.testing, work.timeSpent);
            }
        });
    });

    statsTable.bootstrapTable('load', values(peopleData));
}

// https://docs.atlassian.com/jira/REST/latest/


var startTime = null;
var endTime = null;

async function loadIssues() {

    statsTable.bootstrapTable('showLoading');

    await authenticate();

    var issues = await searchIssues({
        jql: "worklogDate >= '" + isoDate(startTime) + "' AND worklogAuthor in membersOf('" + GROUP + "')",
        fields: "summary,assignee,status,priority,updated,worklog,aggregatetimeoriginalestimate,aggregatetimespent",
        expand: "changelog",
    });

    processIssues(issues);

    statsTable.bootstrapTable('hideLoading');
}

function showDetails(person, role) {

    var result = [];
    activities.forEach(function(activity) {
        var item = {
            issue: activity.issue,
            total: 0,
            development: 0,
            review: 0,
            testing: 0
        };
        activity.work.forEach(function(work) {
            if (work.person != person) {
                return;
            }

            item.total += work.timeSpent;
            if (work.activity == "developer") {
                item.development += work.timeSpent;
            } else if (work.activity == "reviewer") {
                item.review += work.timeSpent;
            } else if (work.activity == "tester") {
                item.testing += work.timeSpent;
            }
        });

        if ((role == "total" && item.total)
            || (role == "development" && item.development)
            || (role == "review" && item.review)
            || (role == "testing" && item.testing)) {
            result.push(item);
        }
    });


//    var issues = filterIssues(person, status);
    detailsTable.bootstrapTable('load', result);

    $("#myModal").modal({keyboard: true});
}

function selectInterval() {

    var days = parseInt($('#interval').val(), 10);

    endTime = new Date();
    startTime = new Date(endTime.valueOf());
    startTime.setDate(startTime.getDate() - days);

    loadIssues();
}

var statsTable;

function initStatsTable() {
    statsTable = $('#stats');
    statsTable.bootstrapTable({
    });

    $(statsTable).on("click", "a[data-type=issue-count]", function(event) {
        event.preventDefault();
        showDetails($(event.target).attr("person"), $(event.target).attr("activity"));
    });

}

var detailsTable;

function initDetailsTable() {
    detailsTable = $('#details');
    detailsTable.bootstrapTable({
    });
}


// Init tables and load data
$(function () {

    initStatsTable();
    initDetailsTable();

    selectInterval();
});

