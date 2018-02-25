#!/usr/bin/env ruby

# This is a tiny web server that does two things:
# 1. Serves static files on /app path (from app/ directory)
# 2. Proxies all requests under /rest path to the specified JIRA server
#    The only reason I am doing this is that JIRA I have to work with does not send any of the CORS headers
#    (like Access-Control-Allow-Origin) so it is not possible to call its REST API from HTML/JavaScript loaded from
#    this server (http://localhost:port) because of the same-origin policy.
# So thanks to this server both JavaScript and and JIRA API have the "same" origin.

# Uses proxybricks - https://github.com/dimas/proxybricks

require_relative '../proxybricks/lib/proxybricks.rb'

# The real HTTP JIRA server we will be proxying requests to. Taken from the command line

class JiraRequestHandler < ProxyingRequestHandler

  def modify_request(request)
    super

    headers = request.headers

    # Remove Referer. Just in case
    headers.remove('Referer')
    # Remove User-Agent too. JIRA does not like mine ("Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:53.0) Gecko/20100101 Firefox/53.0")
    # and POST to login fails with 403 Forbidden ("XSRF check failed"). Without user agent it just works
    headers.remove('User-Agent')
    # Debug: disable gzip/deflate compression so we can see the traffic
    headers.remove('Accept-Encoding')
  end

  def modify_response(response)
    super

    # Remove "Secure" from all the Set-Cookie headers returned because browser won't store them otherwise
    # (The browser makes HTTP connection to the proxy and it does not know that proxy connects to the JIRA with HTTPS)
    response.headers.each { |h|
      h.value.gsub!(/\s*Secure\s*(;|$)/, '') if h.name == 'Set-Cookie'
    }
  end
end

# Get parameters and start the server
if ARGV.size == 2
  port = ARGV[0].to_i
  jira_server = ARGV[1]
else
  puts 'Usage: #{File.basename(__FILE__)} port jiraserver'
  exit 1
end

server = Server.new(port)
server.add_handler '/app/', StaticFilesRequestHandler.new(File.dirname(__FILE__))
server.add_handler '/rest/', JiraRequestHandler.new(jira_server, 443)
server.run


