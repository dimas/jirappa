
The `app/lib/config.js` file needs to be populated first. To prevent its accidental commit the easiest
thing to do is:
```
git update-index --assume-unchanged app/lib/config.js
```

To run server you will need https://github.com/dimas/proxybricks checked out into the same directory as this repository.
Server/proxy is started with:
```
ruby server.rb PORT JIRAHOST
```
`PORT` is the local port server will be listening on and `JIRAHOST` is where your JIRA API is.
Note that HTTPS will be used to talk to JIRA but JavaScript in browser will be
talking plain HTTP to the server/proxy itself.

Then point your browser to http://localhost:PORT/app/index.html
