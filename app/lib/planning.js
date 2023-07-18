
function getDeveloperDisplayName(personKey) {
    var developer = getDeveloperStatsItem(personKey);
    var name = (developer != null) ? developer.displayName : personKey;
    return name ? name : '';
}

function formatAssigneeSelector(value, row, index) {
    // Generate an empty dropdown menu. It has 'dropdown-menu' <ul> element but no items in it.
    // We dynamically populate these menus on click in generateAssigneeDropdownItems()
    // TODO: need to improve overuse of 'style' with classes...
    return '' +
        '  <div class="dropdown" data-type="assignee" issue-key="' + escapeText(row.issue) + '">' +
        '    <button class="btn btn-default dropdown-toggle" type="button" data-toggle="dropdown" style="width: 100%; display: table">' +
        '      <span data-type="active" style="display: table-cell; width: 100%; text-align: left">' + escapeText(getDeveloperDisplayName(value)) + '</span>' +
        '      <span style="display: table-cell; padding-left: 10px"><span class="caret"></span></span>' +
        '    </button>' +
        '    <ul class="dropdown-menu dropdown-menu-right">'+
        '    </ul>' +
        '  </div>';
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

    var total = data.reduce(
        function(sum, row) {
            return sum + (row[field] || 0);
        },
        0);

    return formatDurationDays(total);
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

    developersTableItems[index].setCapacity(parseDurationDays(value));

    developersTable.bootstrapTable('updateRow', [
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

    developersTable.bootstrapTable('updateRow', updates);
}

function getDeveloperStatsItemIndex(key) {
    for (var i = 0; i < developersTableItems.length; i++) {
        var item = developersTableItems[i];
        if (item.developer != null && key == item.developer.accountId) {
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
    return '<input type=text data-type="capacity" person-key="' + escapeText(row.developer.accountId)  + '" value="' + formatDurationDays(capacity) +  '" />';
}


var teamMembers = [];
var teamMemberKeys = [];

var developersTableItems = [];

function calculateAvailable(item) {
    item.available = item.capacity - item.debt - item.selected;
}

function initDevelopersTable() {
    developersTable = $('#developers');
    developersTable.bootstrapTable({
//        data: tableItems
    });

    developersTable.on("change", "input[data-type=capacity]", function(event) {
        event.preventDefault();
        var input = $(event.target);
        updateDeveloperCapacity(input.attr('person-key'), input.val());
    });
}

function personDisplayName(person) {
    // After one of our devs was removed from the organisation, I see him as a structure with
    // active=false, and 'name'. No 'key', no 'displayName', no avatar URLs....
    return person.displayName || person.name;
}

function renderDevelopersTable() {

    var tableItems = [];

    for (var i = 0; i < teamMembers.length; i++) {
      item = {
          developer: teamMembers[i],
          displayName: personDisplayName(teamMembers[i]),
          debt: 0,
          capacity: parseDuration('9d'),
          selected: 0,

          update() {
              this.available = this.capacity - this.debt - this.selected;
          },
          setCapacity(value) {
              this.capacity = value;
              this.update();
          },
          setDebt(value) {
              this.debt = value;
              this.update();
          },
          addDebt(value) {
              this.debt += value;
              this.update();
          },
          setSelected(value) {
              this.selected = value;
              this.update();
          },
          addSelected(value) {
              this.selected += value;
              this.update();
          },
      };
      item.update(); // init 'available'
      tableItems.push(item);
    }

    developersTableItems = tableItems;

    developersTable.bootstrapTable('load', tableItems);
}

function processUserIssues(issues, worklogDays) {

    var worklogCutoff = new Date() - worklogDays * 24 * 60 * 60 * 1000;

    var contributors = [];
    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];

        var worklogs = issue.fields.worklog.worklogs;
        for (j = 0; j < worklogs.length; j++) {
            var worklog = worklogs[j];

            // Ignore too old worklog records
            if (Date.parse(worklog.started.substring(0, 10)) < worklogCutoff) {
                continue;
            }

            // Build unique list of worklog contributors
            contributors.push(worklog.author);
        }
    }

    teamMembers = uniquePeople(contributors).sort(function(a, b) { return compare(a.displayName, b.displayName); });

    // Generate a map of known keys so we can implement isTeamMember without linear search
    teamMemberKeys = [];
    for (i = 0; i < teamMembers.length; i++) {
        teamMemberKeys[teamMembers[i].accountId] = true;
    }

    renderDevelopersTable();
}

function isTeamMember(key) {
    return teamMemberKeys[key];
}

async function loadTeamMembers() {

    developersTable.bootstrapTable('showLoading');

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

    // TODO: our searchIssues makes extra effort to load worklog in full only for the big part of it to be discarded by processUserIssues
    // We have to do it otherwise our never-ending tickets bring in all the old team members because they contributed there one day...

    var issues = await searchIssues({
        jql: "worklogDate > -30d AND worklogAuthor in membersOf('" + GROUP + "')",
        fields: "worklog"
    });

    processUserIssues(issues, 30);

    developersTable.bootstrapTable('hideLoading');
}


///////////////////////////////////////////////////////////////// PLAN

var planTableItems;

function recalculateDevelopersSelected() {

    console.log("recalculateDevelopersSelected()");

    for (var i = 0; i < developersTableItems.length; i++) {
        developersTableItems[i].setSelected(0);
    }

    for (var i = 0; i < planTableItems.length; i++) {
        var item = planTableItems[i];
        var stats = getDeveloperStatsItem(item.selectedAssignee);
        if (stats != null && item.timeProgress.left > 0) {
            stats.addSelected(item.timeProgress.left);
        }
    }
}


function updatePlanAssignment(issueKey, developerKey) {

    console.log("updatePlanAssignment(" + issueKey + ", " + developerKey + ")");

    var teamMember = isTeamMember(developerKey);
    var unassignment = nullifyAssignee(developerKey) == null;

    var updates = [];

    // Apply to both parent task and all its subtasks as well
    for (var i = 0; i < planTableItems.length; i++) {

        // See if this particular developer is available for assignment to this particular ticket.
        // Any team member can be assigned to any ticket but in addition to that, tickets that were assigned to
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
    // and on the second one we were already at target state. It is not a huge deal but refreshing and rebuilding all these tables
    // can be easily avoided so why not do that?...
    if (updates.length == 0) {
        return;
    }

    planTable.bootstrapTable('updateRow', updates);

    recalculateDevelopersSelected();
    refreshDeveloperStatsTable();
}

function initPlanTable() {
    planTable = $('#plan');
    planTable.bootstrapTable({
        // cannot set data-custom-sort in HTML, see https://github.com/wenzhixin/bootstrap-table/issues/2545 for details
        // (the issue is about customSearch which had similar problem but unlike customSort it was fixed)
        customSort: nestedIssueTableSorter
    });

    planTable.on("click", "div.dropdown[data-type=assignee] > ul.dropdown-menu > li", function(event) {
        event.preventDefault();
        var dropdown = $(event.target).closest("div.dropdown");
        var item = $(event.target).closest("li");
        var issueKey = dropdown.attr("issue-key");
        var personKey = item.attr("person-key");

        // Technically there is no need to update the selected (active) text in the dropdown because updatePlanAssignment will
        // cause table to be re-rendered and formatter re-applied to assignment cells so getDeveloperDisplayName() will update the text.
        // But lets do it anyways for completeness so code can be copied to other places easier.
        dropdown.find("span[data-type=active]").text(getDeveloperDisplayName(personKey));

        updatePlanAssignment(issueKey, personKey);
    });

    // Given there is `show.bs.dropdown` event, listening `click` seems to be hacky.
    // However when I tried modifying <ul>'s HTML on `show.bs.dropdown`, it did not work and no popup was shown...
    planTable.on("click", "div.dropdown[data-type=assignee]", function(event) {
        event.preventDefault();
        var dropdown = $(event.target).closest("div.dropdown");
        var list = dropdown.find("ul.dropdown-menu");
        var issueKey = dropdown.attr("issue-key");

        var row = getPlanIssue(issueKey);
        if (row != null) {
            list.html(generateAssigneeDropdownItems(row, true));
        }
    });
}

function processSprintIssues(issues) {

    var tasks = {};

    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];

        var parentIssue = issue.fields.parent;

        // Previously epics were not returned as parents of the issues they contain and now they do.
        // Our UI is not exactly ready for that because it tries to show 2-level hierarchy moving
        // all these issues under epic and not sorting them globally.
        // So, as a quick fix - ignore parent issue if it is an epic.
        if (parentIssue != null && parentIssue.fields.issuetype.name == 'Epic') {
            parentIssue = null;
        }

        if (parentIssue) {
            // It is a subtask
            var taskData = tasks[parentIssue.key];
            // Create parent issue if it is missing
            if (!taskData) {
                taskData = tasks[parentIssue.key] = {
                    key: parentIssue.key,
                    summary: parentIssue.fields.summary,
                    status: issueStatusCode(parentIssue.fields.status.name),
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
        issueData.status = issueStatusCode(issue.fields.status.name);
        issueData.priority = {name: issue.fields.priority.name, iconUrl: issue.fields.priority.iconUrl};
        issueData.timeEstimated = issue.fields.timeoriginalestimate;
        issueData.timeSpent = issue.fields.timespent;
        issueData.timeLeft = issue.fields.timeestimate;
        if (issue.fields.assignee) {
            issueData.assignee = issue.fields.assignee.accountId;
        }
    }

    var tableItems = [];
    var merges = [];

            var tasks = values(tasks).sort(function(a, b) { return compareJiraKey(b.key, a.key); });
            for (var t in tasks) {
                var taskData = tasks[t];
/*
                if (taskData.status == "InTest" || taskData.status == "Closed") {
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
                      left: taskData.timeLeft,
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
                          left: subtaskData.timeLeft,
                        },
                    });
                }
            }

    planTableItems = tableItems;

    planTable.bootstrapTable('load', tableItems);

    recalculateDevelopersSelected();
    refreshDeveloperStatsTable();
}

function getPlanIssue(issueKey) {
    for (var i = 0; i < planTableItems.length; i++) {
        if (item = planTableItems[i].issue == issueKey) {
            return planTableItems[i];
        }
    }
    return null;
}

function generateAssigneeMenuItem(personKey, active, textHtml,detailsHtml) {
    html = '<li';
    if (personKey) {
        html += ' person-key="' + escapeText(personKey) + '"';
    }
    if (active) {
        html += ' class="active"';
    }
    html += ' >'
    html +=   '<a href="#" class="menu-item">';
    html +=     '<span class="menu-text">' + textHtml + '</span>';
    if (detailsHtml) {
        html += '<span class="menu-details">' + detailsHtml + '</span>';
    }

    html +=   '</a>';
    html += '</li>';
    return html;
}

function generateAssigneeDropdownItems(row, showTimeAvailable) {

    const divider = '<li class="divider"></li>';

    var html = '';

    html += generateAssigneeMenuItem(null, nullifyAssignee(row.selectedAssignee) == null, '<i>Unassigned</i>', null);
    html += divider;

    for (var i = 0; i < teamMembers.length; i++) {
      var stats = getDeveloperStatsItem(teamMembers[i].accountId);
      html += generateAssigneeMenuItem(teamMembers[i].accountId,
                                       row.selectedAssignee == teamMembers[i].accountId,
                                       escapeText(personDisplayName(teamMembers[i])),
                                       (showTimeAvailable && stats != null) ? formatDurationDays(stats.available) : null);
    }

    // If ticket's original assignee is not in our team, we still need make that person available in the dropdown for this ticket
    if (row.originalAssignee && !isTeamMember(row.originalAssignee)) {
        html += divider
        html += generateAssigneeMenuItem(row.originalAssignee,
                                         row.selectedAssignee == row.originalAssignee,
                                         escapeText(row.originalAssignee),
                                         null);
    }

    return html;
}

async function loadSprintPlan(id) {

    planTable.bootstrapTable('showLoading');

    await authenticate();

    var issues = await searchIssues({
       jql: "Sprint=" + id + " AND status != 'Closed'",
       fields: 'status,priority,summary,parent,assignee,timeoriginalestimate,timespent,timeestimate'
    });

    processSprintIssues(issues);

    planTable.bootstrapTable('hideLoading');
}

///////////////////////////////////////////////////////////////// DEBT


function formatIssueDebt(debt, row, index) {
    var value = formatDurationDays(debt);
    return '<input type=text data-type="debt" issue-key="' + row.issue  + '" value="' + value +  '" />';
}

var debtTableItems;

function recalculateDevelopersDebt() {

    for (var i = 0; i < developersTableItems.length; i++) {
        developersTableItems[i].setDebt(0);
    }

    for (var i = 0; i < debtTableItems.length; i++) {
        var item = debtTableItems[i];
        var stats = getDeveloperStatsItem(item.selectedAssignee);
        if (stats != null && item.debt > 0) {
            stats.addDebt(item.debt);
        }
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

var debtTable;

function updateIssueDebt(issueKey, value) {
    index = getDebtItemIndex(issueKey);
    debtTableItems[index].debt = parseDurationDays(value);
    debtTable.bootstrapTable('updateRow', [
        {index: index, row: debtTableItems[index]}
    ]);
    recalculateDevelopersDebt();
    refreshDeveloperStatsTable();
}

function updateDebtAssignment(issueKey, developerKey) {
    index = getDebtItemIndex(issueKey);
    debtTableItems[index].selectedAssignee = developerKey;
    recalculateDevelopersDebt();
    refreshDeveloperStatsTable();
}

function initDebtTable() {
    debtTable = $('#debt');
    debtTable.bootstrapTable({
//        data: tableItems
    });

    debtTable.on("change", "input[data-type=debt]", function(event) {
        event.preventDefault();
        var input = $(event.target);
        updateIssueDebt(input.attr('issue-key'), input.val());
    });

    debtTable.on("click", "div.dropdown[data-type=assignee] > ul.dropdown-menu > li", function(event) {
        event.preventDefault();
        var dropdown = $(event.target).closest("div.dropdown");
        var item = $(event.target).closest("li");
        var issueKey = dropdown.attr("issue-key");
        var personKey = item.attr("person-key");

        dropdown.find("span[data-type=active]").text(getDeveloperDisplayName(personKey));

        updateDebtAssignment(issueKey, personKey);
    });

    // Given there is `show.bs.dropdown` event, listening `click` seems to be hacky.
    // However when I tried modifying <ul>'s HTML on `show.bs.dropdown`, it did not work and no popup was shown...
    debtTable.on("click", "div.dropdown[data-type=assignee]", function(event) {
        event.preventDefault();
        var dropdown = $(event.target).closest("div.dropdown");
        var list = dropdown.find("ul.dropdown-menu");
        var issueKey = dropdown.attr("issue-key");

        var row = getDebtIssue(issueKey);
        if (row != null) {
            list.html(generateAssigneeDropdownItems(row, false));
        }
    });
}

function processDebtIssues(issues) {
    var tasks = {};

    for (i = 0; i < issues.length; i++) {
        var issue = issues[i];

        var parentIssue = issue.fields.parent;

        // Previously epics were not returned as parents of the issues they contain and now they do.
        // Our UI is not exactly ready for that because it tries to show 2-level hierarchy moving
        // all these issues under epic and not sorting them globally.
        // So, as a quick fix - ignore parent issue if it is an epic.
        if (parentIssue != null && parentIssue.fields.issuetype.name == 'Epic') {
            parentIssue = null;
        }

        if (parentIssue) {
            // It is a subtask
            var taskData = tasks[parentIssue.key];
            // Create parent issue if it is missing
            if (!taskData) {
                taskData = tasks[parentIssue.key] = {
                    key: parentIssue.key,
                    summary: parentIssue.fields.summary,
                    status: issueStatusCode(parentIssue.fields.status.name),
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
        issueData.status = issueStatusCode(issue.fields.status.name);
        issueData.timeEstimated = issue.fields.timeoriginalestimate;
        issueData.timeSpent = issue.fields.timespent;
        issueData.timeLeft = issue.fields.timeestimate;
        if (issue.fields.assignee) {
            issueData.selectedAssignee = issue.fields.assignee.accountId;
        }
    }

    var tableItems = [];
    var merges = [];

            var tasks = values(tasks).sort(function(a, b) { return compareJiraKey(b.key, a.key); });
            for (var t in tasks) {
                var taskData = tasks[t];

                if (taskData.status == "InTest" || taskData.status == "Closed") {
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


    debtTableItems = tableItems;

    debtTable.bootstrapTable('load', tableItems);

    recalculateDevelopersDebt();
    refreshDeveloperStatsTable();
}


function getDebtIssue(issueKey) {
    for (var i = 0; i < debtTableItems.length; i++) {
        if (item = debtTableItems[i].issue == issueKey) {
            return debtTableItems[i];
        }
    }
    return null;
}

async function loadDebt() {

    debtTable.bootstrapTable('showLoading');

    await authenticate();

    var issues = await searchIssues({
        jql: "project ='" + PROJECT + "' AND sprint in openSprints()",
        fields: 'status,summary,parent,assignee,timeoriginalestimate,timespent,timeestimate'
    });

    processDebtIssues(issues);

    debtTable.bootstrapTable('hideLoading');
}


/////////////////////////////////////////////////////////////////

function nullifyAssignee(assignee) {
    return assignee != null && assignee != "" ? assignee : null;
}

async function applyPlanAssignments() {

    promises = [];

    log = '';

    for (var i = 0; i < planTableItems.length; i++) {
        // 'let' instead of 'var' is important here otherwise callbacks (async functions) will see the same value of 'item'
        let item = planTableItems[i];

        var original = nullifyAssignee(item.originalAssignee);
        var assignee = nullifyAssignee(item.selectedAssignee);

        if (original == assignee) {
            // No change
            continue;
        }

        log += "reassign " + item.issue + " " + item.originalAssignee + " > " + assignee + "\n";

        promises.push(assignIssue(item.issue, assignee));
    }

    // Wait for all updates to complete
    await Promise.all(promises);

    alert("Following changes applied:\n" + log);
}

async function loadAll() {

    await loadTeamMembers();
    await Promise.all([
        loadDebt(),
        discoverSprints()
    ]);
}

// Init tables and load data
$(function () {
    initDevelopersTable();
    initDebtTable();
    initPlanTable();

    loadAll();
});

