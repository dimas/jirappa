
JIRA_SESSION_URL = JIRA_REST_URL + "/rest/auth/1/session"

AUTH_HEADER = 'Basic ' + btoa(JIRA_USERNAME + ':' + JIRA_PASSWORD)

var jiraRequestCount = 0;

async function loadPages(url, list, requestData) {

    var req = ++jiraRequestCount;

    var result = []

    requestData.maxResults = 200;

    while (true) {

        requestData.startAt = result.length;

        console.log("[" + req + "] Requesting " + list + " from " + url);
        console.log("[" + req + "] load page (startAt=" + requestData.startAt + ")");

        response = await jQuery.get({
            url: url,
            headers: {"Authorization": AUTH_HEADER},
            data: requestData,
            dataType: "json"
        });

        var items = response[list];

        console.log("[" + req + "] Received " + items.length + " items, startAt=" + response.startAt + ", maxResults=" + response.maxResults + ", total=" + response.total);

        add(result, items);

        if (result.length >= response.total) {
            // When we loaded all items, we are done. Note however that total may not be present hence the other checks
            console.log("[" + req + "] Finished - reached total count");
            break;
        }

        if (items.length < response.maxResults) {
            // When server returns fewer items than the page size it says it is using, it was the last chunk of data
            // This should help with responses that do not have "total" reported.
            console.log("[" + req + "] Finished - reached last page");
            break;
        }
    }

    return result;
}

async function searchIssues(options) {
    var issues = await loadPages(JIRA_REST_URL + "/rest/api/2/search", 'issues', options);
    await expandWorklogs(issues);
    return issues;
}

async function loadIssueWorklog(issueKey) {
    console.log("Loading worklog for " + issueKey);
    // As far as I can see, startAt and maxResults parameters are ignored by /workflow endpoint - https://jira.atlassian.com/browse/JRACLOUD-65328
    // so there is no point in using loadPages as entire dataset is returned.
    // However it does not hurt to call our pagination method so lets do it, maybe one day JIRA fixes the issue
    return loadPages(JIRA_REST_URL + "/rest/api/2/issue/" + issueKey + "/worklog", 'worklogs', {});
}

// This function tries to mitigate the problem that JIRA search methods only return the first 20 of worklog items
// and there is no conrol over it. So before passing issues to the real handler, we check if any of them have worklogs
// trimmed because of that limit and try using a different API to download full worklog for these.
async function expandWorklogs(issues) {

    promises = [];

    for (var i = 0; i < issues.length; i++) {
        // 'let' instead of 'var' is important here otherwise callbacks (async functions) will see the same value of 'issue'
        let issue = issues[i];

        if (issue.fields.worklog && issue.fields.worklog.worklogs.length < issue.fields.worklog.total) {
            // Need to update issue's worklog. Make update a promise (by invoking async function) so we can wait on all of them together
            promises.push(async function() {
                issue.fields.worklog.worklogs = await loadIssueWorklog(issue.key);
            }());
        }
    }

    // Wait for all updates to complete
    await Promise.all(promises);
}

async function authenticate() {

    console.log('Checking session');

    request = jQuery.get({
        url: JIRA_SESSION_URL,
        headers: {"Authorization": AUTH_HEADER},
        dataType: "json"
    });

    try {

      response = await request;

      console.log('Session ok');

      return;

    } catch (e) {
      if (request.status != 401) {
        // That is something we are not prepared to handle, rethrow
        throw e;
      }
    }

    // We used to do login here but it does not work with modern JIRA
    // See https://developer.atlassian.com/cloud/confluence/deprecation-notice-basic-auth/
    // So in fact our session check should always succeed. If it does not - the credentials are invalid.
    throw 'Invalid auth';
}

async function assignIssue(issue, assignee) {

    console.log("Assign issue " + issue + " to " + assignee);

    request = jQuery.ajax({
        url: JIRA_REST_URL + "/rest/api/2/issue/" + issue,
        type: 'PUT',
        headers: {"Authorization": AUTH_HEADER},
        dataType: "json",
        contentType: "application/json",
        data: JSON.stringify({
            fields: {
                assignee: {
                    accountId: assignee
                }
            }
        }),
    });

    try {
        response = await request;
        console.log("Assigned Ok (" + issue + " => " + assignee + ")");
    } catch (e) {
        console.log("assignIssue failed: " + e);
        console.log(JSON.stringify(request.responseJSON));
    }
}

