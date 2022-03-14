# RM ticket process GitHub Action

**Name:** `coupa/treasury_rm-ticket-process`

This GitHub action automate the release steps that are required by the RM certification board. :rocket:

- Transfers/adds all required information of RM ticket from GitHub to Jira, from the published GitHub release to the corresponding RM ticket based on Jira release.
(tag name -> Jira release) Including table as RM ticket description, commonly used by the other Coupa Apps.
- Creates the next RM ticket with minor version next increment
- Creates the next GitHub release with minor version next increment
- Creates Jira releases on configured Jira projects for the next minor version increment. (support multiple Jira projects)
- Extracts Jira issue keys from git log
- Updates fix version of extracted Jira issues. Supports subtasks by updating corresponding parent story instead of subtask.
- Links extracted Jira issues to RM ticket. Supports subtasks by linking corresponding parent story instead of subtask.
- Generates release notes on GitHub release description

The triggers to launch the action are the following:

- publish the **GitHub release** corresponding to the version that have to be released.
  - for the minor versions, the GitHub release will be automatically created after each publish.
  - for the major version, the GitHub release can be manually created or automated by the `coupa/treasury_create-major-release-version`. The version is extracted from the tag name.
- push on release branches

The prefix of the tag is configurable as described below.

If you are interested in using this kind of action to automate your release process, we could easily adapt the configuration and see if it could fit your needs.

## Usage instructions

This action can only be used by repositories from the Coupa organization.

Create a workflow file (e.g. `.github/workflows/rm-ticket-process.yml`) that contains a step that `uses: coupa/treasury_rm-ticket-process@v1.0`
and is triggered on `released` event of GitHub release (prerelease is excluded), and push on release branches.

Here's an example workflow file:

```yaml
name: RM ticket process
on:
  push:
    branches:
      - 'release/**'
  release:
    types: [released]

jobs:
  rm-ticket-process:
    runs-on: ubuntu-latest
    name: master ticket process
    steps:
      - name: Checkout
        uses: actions/checkout@v2
      - name: Set up Node
        uses: actions/setup-node@v1
        with:
          node-version: 12
      - name: Run master ticket process
        uses: coupa/treasury_rm-ticket-process@v1.0
        with:
          GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
          JIRA_SUBDOMAIN: "coupadev"
          JIRA_USER: "service.account@coupa.com"
          JIRA_TOKEN: ${{secrets.JIRA_TOKEN}}
          JIRA_PROJECTS_IDS: "12345,123456"
          JIRA_PROJECTS_KEYS: "TM,JZ"
          JIRA_MASTER_PROJECT_ID: "987654"
          JIRA_MASTER_PROJECT_KEY: "RM"
          JIRA_MASTER_ISSUE_TYPE: "13802"
          TAG_PREFIX: "ct"
```

**Important:**
- A service account is required for the automation. It needs to have write access to your GitHub repository, Jira projects and PMO Confluence space.
  It must be configured with `JIRA_USER`.
  It requires one token for GitHub and one token for Jira. These tokens `GITHUB_TOKEN` and `JIRA_TOKEN` must be added as secrets on your repository.

You can retrieve the required `JIRA_PROJECTS_IDS` and `JIRA_MASTER_PROJECT_ID` using the Jira REST API.
Here's an example:

Get Jira project ID using the project key ($projectKey).
```bash
curl --request GET \
  --url 'https://coupadev.atlassian.net/rest/api/3/project/$projectKey?expand=issueTypes&properties=key,id,name' \
  --user '$user:$token' \
  --header 'Accept: application/json'
```
