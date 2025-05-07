# Environment Variables Documentation

This document describes all environment variables used in the Playwright visual regression testing framework.

## Core Configuration Variables

| Variable | Description | Example Value | Options |
|----------|-------------|---------------|---------|
| `BASELINE_URL` | The base URL for baseline screenshots | `` | Any valid URL |
| `COMPARISON_URL` | The base URL for comparison screenshots | `` | Any valid URL |
| `PIXEL_DIFF_THRESHOLD` | Maximum allowed pixel difference (0-255) | `10` | 0-255 |
| `HASH_DIFF_THRESHOLD` | Maximum allowed hash difference percentage | `10` | 0-100 |
| `PORT` | Port number for the server | `9222` | Any valid port number |
| `REPORTS_ROOT_DIR` | Directory where reports will be stored | `public` | Any valid directory path |
| `FAILURE_THRESHOLD` | Percentage of failed tests that triggers a full failure | `0.1` | 0-1 |
| `HIGH_SIMILARITY_THRESHOLD` | Percentage threshold for high similarity | `90` | 0-100 |
| `MEDIUM_SIMILARITY_THRESHOLD` | Percentage threshold for medium similarity | `80` | 0-100 |

## Authentication Configuration

| Variable | Description | Example Value | Options |
|----------|-------------|---------------|---------|
| `AUTHENTICATION_BASELINE` | Authentication method for baseline site | `BASIC` | `NONE`, `BASIC`, `OKTA` |
| `AUTHENTICATION_COMPARISON` | Authentication method for comparison site | `NONE` | `NONE`, `BASIC`, `OKTA` |
| `HTTP_USERNAME` | Username for HTTP Basic Authentication | `` | Any string |
| `HTTP_PASSWORD` | Password for HTTP Basic Authentication | `` | Any string |

## Element Visibility Configuration

| Variable | Description | Example Value | Options |
|----------|-------------|---------------|---------|
| `PAGE_ELEMENTS` | Controls which elements to show/hide | `EMBED` | `ALL`, `HIDE`, `EMBED` |
| `EMBED_DATA_BLOCK` | Data block attribute to isolate | `content-main` | Any valid data-block attribute value |
| `EMBED_DATA_HIDE_COMPARISON` | Selectors to hide in comparison screenshots | `"a[data-arship-back=\"1\"]"` | Any valid CSS selector(s), comma-separated |
| `EMBED_DATA_HIDE_BASELINE` | Selectors to hide in baseline screenshots | `".sidebar-grid h1,.sidebar-grid__sidebar"` | Any valid CSS selector(s), comma-separated |

## Okta Authentication (for protected sites)

| Variable | Description | Example Value | Options |
|----------|-------------|---------------|---------|
| `OKTA_CLIENT_ID` | Okta client ID | `` | Valid Okta client ID |
| `OKTA_USERNAME` | Okta username | `` | Valid email address |
| `OKTA_PASSWORD` | Okta password | `!` | Any string |
| `OKTA_ANSWER` | Answer to Okta security question | `` | Any string |
| `OKTA_DOMAIN` | Okta domain | `` | Valid domain |
| `OKTA_REDIRECT_URI` | Redirect URI after Okta authentication | `` | Valid URL |

## Testing Configuration

| Variable | Description | Example Value | Options |
|----------|-------------|---------------|---------|
| `URLS_FILE` | JSON file containing URLs to test | `urls-local.json` | Any valid JSON filename in fixtures/urls/ |

## Environment Files

### .env

The main environment file containing default values for all environments.

### .env.local

A local override file that is not committed to the repository. It typically contains sensitive information like authentication credentials for local development.

## GitHub Actions Secrets

When running in GitHub Actions, the following variables should be stored as GitHub Secrets for security:

- `HTTP_USERNAME`
- `HTTP_PASSWORD`
- `OKTA_CLIENT_ID`
- `OKTA_USERNAME`
- `OKTA_PASSWORD`
- `OKTA_ANSWER`
- `OKTA_DOMAIN`
- `OKTA_REDIRECT_URI`

## Notes on Specific Variables

### EMBED_DATA_HIDE_COMPARISON and EMBED_DATA_HIDE_BASELINE

These variables accept CSS selectors to hide specific elements in screenshots. Multiple selectors can be provided as a comma-separated list. When these variables contain spaces or special characters, they must be enclosed in quotes.

Examples:
- Simple class: `.sidebar-grid__sidebar`
- Complex selector: `.sidebar-grid h1`
- ID selector: `#main`
- Attribute selector: `a[data-scholarship-back="1"]`

### AUTHENTICATION_BASELINE and AUTHENTICATION_COMPARISON

These variables control the authentication method used for each site:
- `NONE`: No authentication
- `BASIC`: HTTP Basic Authentication (requires HTTP_USERNAME and HTTP_PASSWORD)
- `OKTA`: Okta Authentication (requires OKTA_* variables)

### PAGE_ELEMENTS

Controls which elements are shown in screenshots:
- `ALL`: Show all elements
- `HIDE`: Hide specific elements (deprecated)
- `EMBED`: Show only the main content block and hide specified elements within it
