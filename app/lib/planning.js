
function formatAssigneeSelector(assignee, row, index) {
    var result = '';

    result += '<select size="1" data-type="assignee" issue-key="' + row.issue + '">';

    result += '<option value=""></option>';

    for (var i = 0; i < teamMembers.length; i++) {
      result += '<option value="' + teamMembers[i].key + '"' + (row.selectedAssignee == teamMembers[i].key ? ' selected' : '') +   '>';
      result += teamMembers[i].displayName;
      result += '</option>';
    }

    // If ticket's original assignee is not in our team, we still need make that person available in the dropdown for this ticket
    if (row.originalAssignee && !isTeamMember(row.originalAssignee)) {
        result += '<option value="">----</option>';
        result += '<option value="' + row.originalAssignee + '"' + (row.selectedAssignee == row.originalAssignee ? ' selected' : '') +   '>' + row.originalAssignee + '</option>';
    }

    result += '</select>';

    return result;
}

PRIORITY_ORDER = [
    "Un-Prioritized",
    "Trivial",
    "Minor",
    "Major",
    "Critical",
    "Blocker",
]

function getPriorityOrder(priorityName) {
    return PRIORITY_ORDER.indexOf(priorityName);
}

function formatIssuePriority(priority) {
    return '<img style="width: 16px; height: 16px" src="' + priority.iconUrl + '" title="' +  priority.name + '"/>';
}

function issuePrioritySorter(a, b) {
    return compare(getPriorityOrder(a.name), getPriorityOrder(b.name));
}

// Issue comparator that orders subtickets based on their parents order.
// See nestedIssueTableSorter description as why do we need this.
//
// NOTE: The 'comparator' passed should NEVER return zero. If this happens, you may get subtle and difficult
// to reproduce sorting issues. We order subtasks based on their parent tasks but
// when comparator return 0 for the parents, it still does not mean subtasks can be treated as equal!
//
function hierarchicalCompare(a, b, comparator) {
    if (a.parent == null && b.parent == null) {
        // Both are top level tickets, just compare them directly
        return comparator(a, b);
    } else if (a.parent == b.parent) {
        // Both are subtickets of the same parent - compare directly
        return comparator(a, b);
    } else if (a.parent == b) {
        // 'b' is parent ticket of 'a', so 'a' must always be after 'b'
        return 1;
    } else if (a == b.parent) {
        // 'a' is parent ticket of 'b', so 'a' must always be before 'b'
        return -1;
    } else if (a.parent == null) {
        // 'a' is a top-level ticket while 'b' is a sub-ticket. Order is determined by relationship between 'a' and parent of 'b'
        return comparator(a, b.parent);
    } else if (b.parent == null) {
        // 'a' is a subticket while 'a' is a top-level ticket. Order is determined by relationship between 'b' and parent of 'a'
        return comparator(a.parent, b);
    } else {
        // These are subtickets of different parents - just compare their parents
        return comparator(a.parent, b.parent);
    }
}

// Custom sorter for the issue table.
// The trick is that our table may contain subtickets that follow some of the top-level tickets.
// This could be better represented if sub-tickets were a "details" view but then each would be
// a separate sub-table with its own columns not aligned with the main table, different formatting etc.
// So instead I opted for sub-tickets being just "special" rows in the same table.
// Because of that, these subtickets should always go immediately after their top level parent tickets
// no matter what sorting order is used - ascending or descending, and sorting by which column is done.
//
function nestedIssueTableSorter(sortName, sortOrder) {
    console.log("customSort: " + sortName + ", " + sortOrder);

    const index = this.header.fields.indexOf(this.options.sortName);

    // Do not attempt to sort by nonexistent column. During init we are called with undefined
    // Just mimic logic from the bootstrap table default sorter: https://github.com/wenzhixin/bootstrap-table/blob/7b6a3342d5ac32735ed44318a66a8292ac2e0fa1/src/bootstrap-table.js#L958
    if (index == -1) {
        return;
    }

    // Extractor gets value for a field.
    // Super simplified implementation of https://github.com/wenzhixin/bootstrap-table/blob/7b6a3342d5ac32735ed44318a66a8292ac2e0fa1/src/bootstrap-table.js#L243
    extractor = function(item) {
        let value = item;
        for (const p of sortName.split('.')) {
            value = value && value[p];
        }
        return value;
    }

    // Check if the column has a custom sorter
    // Super simplified implementation of what bootstrap table itself does
    // See https://github.com/wenzhixin/bootstrap-table/blob/7b6a3342d5ac32735ed44318a66a8292ac2e0fa1/src/bootstrap-table.js#L971 
    // and https://github.com/wenzhixin/bootstrap-table/blob/7b6a3342d5ac32735ed44318a66a8292ac2e0fa1/src/bootstrap-table.js#L166
    // for details.
    var sorter = null;
    var sorterName = this.header.sorters[index];
    if (typeof sorterName === 'string') {
        var func = window;
        for (const f of sorterName.split('.')) {
            func = func && func[f];
        }

        if (func == null) {
            return;
        }

        sorter = func;
    } else {
        // If no sorter is given use some simple default that just compares values
        // (it will be invoked with (vala, valbm, rowa, rowb) but will ignore the last two params)
        sorter = compare;
    }

    var order = (sortOrder == "desc") ? -1 : 1;

    var comparator = function(a, b) {
        var result = sorter(extractor(a), extractor(b), a, b);
        if (result != 0) {
            return order * result;
        }
        // When from sorter's perspective objects are equal and it cannot put one of them ahead of another,
        // we need to introduce some other (stable!) sorting as we should never pass a zero-returning
        // comparator to compareNestedItems() - see comment there.
        return order * compare(a.issue, b.issue);
    };

    this.data.sort(function (a, b) { return hierarchicalCompare(a, b, comparator); } );
}

///////////////////////////////////////////////////////////////// SPRINTS

function populateSprintSelector(sprints) {

    var futureSprints = [];
    var seen = {};
    for (var i = 0; i < sprints.length; i++) {
        var sprint = sprints[i];
        if (sprint.state == 'future' && !seen[sprint.id]) {
            seen[sprint.id] = true;
            futureSprints.push(sprint);
        }
    }

    var options = $("#sprint-selector");
    options.empty();

    options.append(new Option());

    futureSprints = values(futureSprints).sort(compare);
    for (var i = 0; i < futureSprints.length; i++) {
        options.append(new Option(futureSprints[i].name, futureSprints[i].id));
    }

    options.on("change", async function(event) {
        event.preventDefault();
        await loadSprintPlan(options.val());
    });
}

async function discoverSprints() {

    await authenticate();

    boards = await loadPages(JIRA_REST_URL + "/rest/agile/1.0/board", 'values', {projectKeyOrId: PROJECT});

    promises = [];

    var projectSprints = [];
    for (var i = 0; i < boards.length; i++) {
        // type='kanban' boards will return:
        //     {"errorMessages":["The board does not support sprints"],"errors":{}}
        if (boards[i].type == 'scrum') {
            console.log("Loading sprints from agile board " + boards[i].id);
            promises.push(async function() {
              sprints = await loadPages(JIRA_REST_URL + "/rest/agile/1.0/board/" + boards[i].id + '/sprint', 'values', {});
              add(projectSprints, sprints);
            }());
        }
    }

    // Wait for all updates to complete
    await Promise.all(promises);

    // We have all the sprints data
    populateSprintSelector(projectSprints);
}


///////////////////////////////////////////////////////////////// DEVELOPER STATS

function totalLabelFooterFormatter(data) {
    return 'TOTAL';
}

function totalDurationFooterFormatter(data) {
    var field = this.field;

    var total_sum = data.reduce(
        function(sum, row) {
            return (sum) + (parseInt(row[field]) || 0);
        },
        0);

    return formatDurationDays(total_sum);
}

function developersFooterStyle(value, row, index) {
    return {
        css: { "font-weight": "bold", "text-align": "right" }
    };
}

function updateDeveloperCapacity(key, value) {

    var index = getDeveloperStatsItemIndex(key);
    if (index == -1) {
        return;
    }

    developersTableItems[index].capacity = parseDurationDays(value);
    developersTableItems[index].update();

    $('#developers').bootstrapTable('updateRow', [
        {index: index, row: developersTableItems[index]},
    ]);
}

function refreshDeveloperStatsTable() {
    // I am just asking table to update all its rows. From the bootstrap code it looks like
    // the full update is done even if we ask to update only one row.
    // But it does not cause performance issues so lets be good guys here.
    var updates = [];
    for (var i = 0; i < developersTableItems.length; i++) {
        updates.push({index: i, row: developersTableItems[i]});
    }

    $('#developers').bootstrapTable('updateRow', updates);
}

function getDeveloperStatsItemIndex(key) {
    for (var i = 0; i < developersTableItems.length; i++) {
        var item = developersTableItems[i];
        if (item.developer != null && key == item.developer.key) {
            return i;
        }
    }
    return -1;
}

function getDeveloperStatsItem(key) {
    var index = getDeveloperStatsItemIndex(key);
    return index != -1 ? developersTableItems[index] : null;
}

function developerStatsRowStyle(row, index) {
    if (row.developer == null) {
        return {
              css: {'font-weight': 'bold'}
        };
    }
    return { };
}

function formatDeveloperCapacity(capacity, row, index) {
    var value = formatDurationDays(capacity);
    if (row.developer != null) {
        return '<input type=text data-type="capacity" person-key="' + row.developer.key  + '" value="' + value +  '" />';
    } else {
        // Totals
        return value;
    }
}


var teamMembers = [];
var teamMemberKeys = [];

var developersTableItems = [];

function calculateAvailable(item) {
    item.available = item.capacity - item.debt - item.selected;
}

function renderDevelopersTable() {

    var tableItems = [];

    for (var i = 0; i < teamMembers.length; i++) {
      tableItems.push({
          developer: teamMembers[i],
          displayName: teamMembers[i].displayName,
          debt: 0,
          capacity: parseDuration('9d'),
          selected: 0,
          update() { this.available = this.capacity - this.debt - this.selected; }
      });
    }

    for (var i = 0; i < tableItems.length; i++) {
        tableItems[i].update();
    }

developersTableItems = tableItems;

    table = $('#developers');
    table.bootstrapTable({
//        data: tableItems
    });

    table.bootstrapTable('load', tableItems);

    table.on("change", "input[data-type=capacity]", function(event) {
        event.preventDefault();
        var input = $(event.target);
        updateDeveloperCapacity(input.attr('person-key'), input.val());
    });

}

function processUserIssues(issues) {

    var contributors = [];
    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];

        var worklogs = issue.fields.worklog.worklogs;
        for (j = 0; j < worklogs.length; j++) {
            var worklog = worklogs[j];
            // Build unique list of worklog contributors
            contributors.push(worklog.author);
        }
    }

    teamMembers = uniquePeople(contributors).sort(function(a, b) { return compare(a.displayName, b.displayName); });

    // Generate a map of known keys so we can implement isTeamMember without linear search
    teamMemberKeys = [];
    for (i = 0; i < teamMembers.length; i++) {
        teamMemberKeys[teamMembers[i].key] = true;
    }

    renderDevelopersTable();
}

function isTeamMember(key) {
    return teamMemberKeys[key];
}

async function loadTeamMembers() {

    $('#developers').bootstrapTable('showLoading');

    await authenticate();

    // I can think of several ways of getting users for a project
    //   1. Most obvious one - query our named group - /rest/api/2/group?groupname=#{GROUP}
    //      However for some weird reason it requires admin permissions
    //   2. Get all developers of a project with /rest/api/2/project/#{PROJECT}
    //      But someone has to configure the project properly (again, I do not have permissions).
    //      And  then it does not seem to be possible to use that for finding all the issues recently modified by users having particular role
    //      in the given project for worklog reports. So we will still have to use named group for that.
    //      And maintaining two groups sucks a bit
    //   3. Just find all worksheets done by members of our named group for the last month and build unique list of users.
    //      Not ideal (epecially when someone from another team submits worklog into our issues for any reason)
    //      but better than nothing.

    var issues = await searchIssues({
        jql: "worklogDate > -30d AND worklogAuthor in membersOf('" + GROUP + "')",
        fields: "worklog"
    });

    processUserIssues(issues);

    $('#developers').bootstrapTable('hideLoading');
}


///////////////////////////////////////////////////////////////// PLAN

var planTableItems;

function recalculateDevelopersSelected() {

    console.log("recalculateDevelopersSelected()");

    for (var i = 0; i < developersTableItems.length; i++) {
        developersTableItems[i].selected = 0;
    }

    for (var i = 0; i < planTableItems.length; i++) {
        var item = planTableItems[i];
        var stats = getDeveloperStatsItem(item.selectedAssignee);
        if (stats != null) {
            stats.selected += item.timeProgress.estimated;
        }
    }

    for (var i = 0; i < developersTableItems.length; i++) {
        developersTableItems[i].update();
    }
}


function updateAssignment(issueKey, developerKey) {

    console.log("updateAssignment(" + issueKey + ", " + developerKey + ")");

    var teamMember = isTeamMember(developerKey);
    var unassignment = nullifyAssignee(developerKey) == null;

    var updates = [];

    // Apply to both parent task and all its subtasks as well
    for (var i = 0; i < planTableItems.length; i++) {

        // See if this particular developer is available for assignment to this particular ticket.
        // Any team member can be assigned to any ticket but in addition to that tickets that were assigned to
        // people outside of the team initially can be assigned back to them - we keep the original assignee available in the dropdown.
        // Also we always can unassign.
        // So availableForAssignment effectively means that developerKey is present in the assignment dropdown for this ticket.
        var availableForAssignment = teamMember || unassignment || developerKey == planTableItems[i].originalAssignee;

        // We accept direct assignment of any ticket to any developer no questions asked but when propagating the change
        // to subtickets we only do that if new developer is available for that subticket.
        // Otherwise that assignment cannot be displayed properly as the subticket does not have this person in the dropdown.
        if (planTableItems[i].issue == issueKey || (planTableItems[i].parentIssue == issueKey && availableForAssignment)) {

            // Skip the change if it is not needed - see comment after the loop
            if (planTableItems[i].selectedAssignee == developerKey) {
                continue;
            }

            console.log(planTableItems[i].issue + " => " + developerKey);

            planTableItems[i].selectedAssignee = developerKey;

            // Judging from bootstrap table code https://github.com/wenzhixin/bootstrap-table/blob/7b6a3342d5ac32735ed44318a66a8292ac2e0fa1/src/bootstrap-table.js#L2630
            // the table does a full update on any updateRow() call. So there is a little point actually building an accurate 'updates' list
            // as any update to an arbitrary (like first) row always refreshes everything.
            // But lets be good guys and do everything properly.
            updates.push({index: i, row: planTableItems[i]});
        }
    }

    // Stop here if there is there were no changes. I saw the change event firing multiple times
    // and on the second one we were already at target state. It is not a huge deal but refreshing and rebuilding all thesetables
    // can be easily avoided so why not do that?...
    if (updates.length == 0) {
        return;
    }

    $('#plan').bootstrapTable('updateRow', updates);

    recalculateDevelopersSelected();
    refreshDeveloperStatsTable();
}

function processSprintIssues(issues) {

    var tasks = {};

    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];

        var parentIssue = issue.fields.parent; 
        if (parentIssue) {
            // It is a subtask
            var taskData = tasks[parentIssue.key];
            // Create parent issue if it is missing
            if (!taskData) {
                taskData = tasks[parentIssue.key] = {
                    subtasks: {}
                };
            }

            issueData = taskData.subtasks[issue.key] = {}

        } else {
            // It is a parent or a standalone issue
            // Note that it may exist in the map already if we found one of subtasks first
            // so we cannot just replace it or we will lose its existing 'subtasks' field
            issueData = tasks[issue.key];
            if (!issueData) {
                issueData = tasks[issue.key] = {
                    subtasks: {}
                };
            }
        }

        issueData.key = issue.key;
        issueData.summary = issue.fields.summary;
        issueData.status = issue.fields.status.name;
        issueData.priority = {name: issue.fields.priority.name, iconUrl: issue.fields.priority.iconUrl};
        issueData.timeEstimated = issue.fields.timeoriginalestimate;
        issueData.timeSpent = issue.fields.timespent;
        if (issue.fields.assignee) {
            issueData.assignee = issue.fields.assignee.key;
        }
    }

    var tableItems = [];
    var merges = [];

            var tasks = values(tasks).sort(function(a, b) { return compareJiraKey(b.key, a.key); });
            for (var t in tasks) {
                var taskData = tasks[t];
/*
                if (taskData.status == "In Test" || taskData.status == "Closed") {
                    // Ignore finished tasks
                    continue;
                }
*/
                parentItem = {
                    issue: taskData.key,
                    issueSummary: taskData.summary,
                    issueStatus: taskData.status,
                    issuePriority: taskData.priority,
                    originalAssignee: taskData.assignee,
                    selectedAssignee: taskData.assignee,
                    timeProgress: {
                      estimated: taskData.timeEstimated,
                      spent: taskData.timeSpent,
                    },
                };

                tableItems.push(parentItem);

                var subtasks = values(taskData.subtasks).sort(function(a, b) { return compareJiraKey(b.key, a.key); });
                for (var s in subtasks) {
                    var subtaskData = subtasks[s];

                    tableItems.push({
                        issue: subtaskData.key,
                        issueSummary: subtaskData.summary,
                        issueStatus: subtaskData.status,
                        issuePriority: subtaskData.priority,
                        parentIssue: taskData.key,
                        parent: parentItem,
                        originalAssignee: subtaskData.assignee,
                        selectedAssignee: subtaskData.assignee,
                        timeProgress: {
                          estimated: subtaskData.timeEstimated,
                          spent: subtaskData.timeSpent,
                        },
                    });
                }
            }

    planTableItems = tableItems;

    table = $('#plan');
    table.bootstrapTable({
        // cannot set data-custom-sort in HTML, see https://github.com/wenzhixin/bootstrap-table/issues/2545 for details
        // (the issue is about customSearch which had similar problem but unlike customSort it was fixed)
        customSort: nestedIssueTableSorter
    });

    table.bootstrapTable('load', tableItems);

    table.on("change", "select[data-type=assignee]", function(event) {
        event.preventDefault();
        var input = $(event.target);
        updateAssignment(input.attr('issue-key'), input.val());
    });

    recalculateDevelopersSelected();
    refreshDeveloperStatsTable();
}

async function loadSprintPlan(id) {

    $('#plan').bootstrapTable('showLoading');

    await authenticate();

    var issues = await searchIssues({
       jql: "Sprint=" + id + "",
       fields: 'status,priority,summary,parent,assignee,timeoriginalestimate,timespent'
    });

    processSprintIssues(issues);

    $('#plan').bootstrapTable('hideLoading');
}

///////////////////////////////////////////////////////////////// DEBT


function formatIssueDebt(debt, row, index) {
    var value = formatDurationDays(debt);
    return '<input type=text data-type="debt" issue-key="' + row.issue  + '" value="' + value +  '" />';
}

var debtTableItems;

function recalculateDevelopersDebt() {

    for (var i = 0; i < developersTableItems.length; i++) {
        developersTableItems[i].debt = 0;
    }

    for (var i = 0; i < debtTableItems.length; i++) {
        var item = debtTableItems[i];
        var stats = getDeveloperStatsItem(item.selectedAssignee);
        if (stats != null && item.debt > 0) {
            stats.debt += item.debt;
        }
    }

    for (var i = 0; i < developersTableItems.length; i++) {
        developersTableItems[i].update();
    }
}

function getDebtItemIndex(issueKey) {
    for (var i = 0; i < debtTableItems.length; i++) {
        if (debtTableItems[i].issue == issueKey) {
            return i;
        }
    }

    return -1;
}

function updateIssueDebt(issueKey, value) {
    index = getDebtItemIndex(issueKey);
    debtTableItems[index].debt = parseDurationDays(value);
    $('#debt').bootstrapTable('updateRow', [
        {index: index, row: debtTableItems[index]}
    ]);
    recalculateDevelopersDebt();
    refreshDeveloperStatsTable();
}

function updateDebtAssignment(issueKey, developerIndex) {
    index = getDebtItemIndex(issueKey);
    debtTableItems[index].selectedAssignee = developerIndex;
    recalculateDevelopersDebt();
    refreshDeveloperStatsTable();
}

function processDebtIssues(issues) {
    var tasks = {};

    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];

        var parentIssue = issue.fields.parent; 
        if (parentIssue) {
            // It is a subtask
            var taskData = tasks[parentIssue.key];
            // Create parent issue if it is missing
            if (!taskData) {
                taskData = tasks[parentIssue.key] = {
                    subtasks: {}
                };
            }

            issueData = taskData.subtasks[issue.key] = {}

        } else {
            // It is a parent or a standalone issue
            // Note that it may exist in the map already if we found one of subtasks first
            // so we cannot just replace it or we will lose its existing 'subtasks' field
            issueData = tasks[issue.key];
            if (!issueData) {
                issueData = tasks[issue.key] = {
                    subtasks: {}
                };
            }
        }

        issueData.key = issue.key;
        issueData.summary = issue.fields.summary;
        issueData.status = issue.fields.status.name;
        issueData.timeEstimated = issue.fields.timeoriginalestimate;
        issueData.timeSpent = issue.fields.timespent;
        issueData.timeLeft = issue.fields.timeestimate;
        if (issue.fields.assignee) {
            issueData.selectedAssignee = issue.fields.assignee.key;
        }
    }


    var tableItems = [];
    var merges = [];

            var tasks = values(tasks).sort(function(a, b) { return compareJiraKey(b.key, a.key); });
            for (var t in tasks) {
                var taskData = tasks[t];

                if (taskData.status == "In Test" || taskData.status == "Closed") {
                    // Ignore finished tasks
                    continue;
                }

                tableItems.push({
                    issue: taskData.key,
                    issueSummary: taskData.summary,
                    issueStatus: taskData.status,
                    selectedAssignee: taskData.selectedAssignee,
                    timeProgress: {
                      estimated: taskData.timeEstimated,
                      spent: taskData.timeSpent,
                      left: taskData.timeLeft
                    },
                    debt: taskData.timeLeft
                });

                var subtasks = values(taskData.subtasks).sort(function(a, b) { return compareJiraKey(b.key, a.key); });
                for (var s in subtasks) {
                    var subtaskData = subtasks[s];

                    tableItems.push({
                        issue: subtaskData.key,
                        issueSummary: subtaskData.summary,
                        issueStatus: subtaskData.status,
                        parentIssue: taskData.key,
                        selectedAssignee: subtaskData.selectedAssignee,
                        timeProgress: {
                          estimated: subtaskData.timeEstimated,
                          spent: subtaskData.timeSpent,
                          left: subtaskData.timeLeft
                        },
                        debt: subtaskData.timeLeft
                    });
                }
            }


    table = $('#debt');
    table.bootstrapTable({
//        data: tableItems
    });

    table.bootstrapTable('load', tableItems);

    debtTableItems = tableItems;

    table.on("change", "input[data-type=debt]", function(event) {
        event.preventDefault();
        var input = $(event.target);
        updateIssueDebt(input.attr('issue-key'), input.val());
    });

    table.on("change", "select[data-type=assignee]", function(event) {
        event.preventDefault();
        var input = $(event.target);
        updateDebtAssignment(input.attr('issue-key'), input.val());
    });


    recalculateDevelopersDebt();
    refreshDeveloperStatsTable();
}

async function loadDebt() {

    $('#debt').bootstrapTable('showLoading');

    await authenticate();

    var issues = await searchIssues({
        jql: "project ='" + PROJECT + "' AND sprint in openSprints()",
        fields: 'status,summary,parent,assignee,timeoriginalestimate,timespent,timeestimate'
    });

    processDebtIssues(issues);

    $('#debt').bootstrapTable('hideLoading');
}


/////////////////////////////////////////////////////////////////

function nullifyAssignee(assignee) {
    return assignee != null && assignee != "" ? assignee : null;
}

async function applyPlanAssignments() {

    promises = [];

    for (var i = 0; i < planTableItems.length; i++) {
        // 'let' instead of 'var' is important here otherwise callbacks (async functions) will see the same value of 'item'
        let item = planTableItems[i];

        var original = nullifyAssignee(item.originalAssignee);
        var assignee = nullifyAssignee(item.selectedAssignee);

        if (original == assignee) {
            // No change
            continue;
        }

        console.log("reassign " + item.issue + " " + item.originalAssignee + " > " + assignee);

        promises.push(assignIssue(item.issue, assignee));
    }

    // Wait for all updates to complete
    await Promise.all(promises);
}

async function loadAll() {

    await loadTeamMembers();
    await Promise.all([
        loadDebt(),
        discoverSprints()
    ]);
//loadSprintPlan(2224);
}

// Init tables and load data
$(function () {
    processDebtIssues([]);
    processUserIssues([]);
    processSprintIssues([]);
    loadAll();
});

