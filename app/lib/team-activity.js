
function addWork(item, timeSpent) {
    item.ticketCount++;
    item.timeSpent += timeSpent;
}

function processIssues(issues) {

    var peopleData = {};

    issues.forEach(function(issue) {
        var activity = analyzeActivity(issue);
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


async function loadIssues() {

    statsTable.bootstrapTable('showLoading');

    await authenticate();

    var issues = await searchIssues({
        jql: "project ='" + PROJECT + "' AND sprint in openSprints() and issuetype not in subtaskIssueTypes()",
        fields: "summary,assignee,status,priority,updated,worklog,aggregatetimeoriginalestimate,aggregatetimespent",
        expand: "changelog",
    });

    processIssues(issues);

    statsTable.bootstrapTable('hideLoading');
}

var statsTable;

function initStatsTable() {
    statsTable = $('#stats');
    statsTable.bootstrapTable({
    });
}

// Init tables and load data
$(function () {
    initStatsTable();

    loadIssues();
});

