# Background
This is a small project to build a working prototype/simulation of a novel load balancer backpressure mechanism.
Servers sometimes have small pauses from the single digit to low hundreds of millisecond range. When this
happens the load balancer continues to send requests to the host causing requests to pile up in the OS' request queue.
When the server resumes from the pause it now has a backlog of requests to process in addition to the requests continuing
to show up. For heavily loaded servers processing low latency requests this can pose significant p99 impact.

Examples where this can happen:
- Java JVM pauses for safepoints or GC (especially G1GC)
- Python with a long held GIL
- Node.js event loop starvation
- Go stop the world GC pauses

## Real world example
The inspiration for this experiment was from a real world use case I had on a Java database frontend. The system
had large heap sizes which required longer G1GC pauses to effectively process Young Gen / survivor regions. The
target GC pause time was set to 200ms. For something where we were targeting sub 10ms p50 latencies and sub
50ms p99 latencies this would have been disasterous for our tail latencies. When studying the effect on our
benchmarks and real production instances I found that a single GC pause of 200ms could actually end up taking
multiple seconds to recover from. 

Upon investigating I found the OS queue buildup and the resoluting thundering herd problem. For architectual
reasons relating to a legacy workload we had a near unbounded request thread pool. Not only did we have a
backlog of work in the queue but we would drain the queue almost instantly once the JVM resumed and assign
work to threads and/or expand the request handler thread pool. This introduced additional strain that impacted
in-flight requests as well as the new ones by increasing Linux scheudler runqueue depths and context switching
required to complete a request. This in turn caused more L1i/L2i cache threashing, branch predictor BTB thrashing
etc. In short the one GC pause had a cascading effect that could take over 10x the pause duration to recover from.

# Project
For this experiment / simulation we will implement a few components.

- Load Balancer: We will implement a small load balancer layer that does round robin request routing. This will be
  implemented in typescript. We will do this instead of using Envoy to keep the logic completely within the simulation
  and avoid adding exra dependencies. A real production implementation would likely be an Envoy plugin though.

- Sidecar: We will implement a small typescript sidecar process that will run with our servers. This will monitor for
  server pauses and communicate with the load balancer to stop traffic routing when the server is paused. This will
 essentially have an inner loop that checks with sub-millisecond frequency if the application is paused. If so it will
 send a DRAIN:<duration> command to the load balancer. If the application resumes it will send a RESUME command. To handle
 possible network issues we will repeatedly send DRAIN commands at least every drainInterval / 2. We will do the same
 for RESUME. On the load balancer the last command for a server wins.

- Servers: We will implement a couple of very simple servers that suffer from pauses. These won't do much except force
  a pause to happen.

- Load Generator: We will implement a small load generator that will send requests at a fixed request per second to a
  URI for a fixed duration. The load generator needs to be able to be run from the command line, taking command line
  arguements to control the inputs. We will also need to have this run in a server mode where it can take an HTTP GET
  request with query string arguments for the inputs.

- Web server / UI: We will want to build a lightweight node.js backend web server and a React UI. The webserver should
  monitor metrics from the other services by scraping a /metrics endpoint that returns metrics in OpenTelemetry format.
  This is simply to avoid adding complexity by setting up something like Prometheus for durable storage as we don't
  need that for the simulation. The UI will display charts for each metric and update in near-realtime (1-2s refresh rate).
  The UI will also contain inputs for the simulation and a run button. This will be the primary artifact that people
  will interact with.

## Project Structure & Gudelines
### Coding Agenets
The project will be developed by Claude Code. We should include a CLAUDE.md file in the top level directory.

### Docker

### DevEx Tooling
To make the project simple for others to interact with we should build two shell scripts:
- setup.sh: That should evolve over time to include all package installs required to setup the project on a different host.

- run.sh: That will include sub-commands to interact with the project / code base in different ways. Mostly these will
 be abstractions around node & docker commands. 

 `run.sh up` brings up the docker containers (this should also check if docker is running and bring it up if not)
 `run.sh down` brings down the docker containers
 `run.sh build <target>` should build the specified target
 `run.sh lint <target>` should run the linter on the target
 `run.sh test <arget>` should run the unit tests for the target
 `run.sh` or `run.sh help` should print the usage message for the run.sh script.

### Coding Guidelines
- All code should be well commented. All classes should contain a class level comment, all methods should contain a method level comment.
- Class and method comemnts should follow javadoc style and include `@param` and `@returns` as applicable.
- Detailed algorithmic descriptions that are not important to the method caller should be contained within the method body.
- Class, method, and variable names should follow Camel Case conventions with Classes starting with an upper case letter and methods & variables starting with a lower case letter. 
- All file names should be in snake case
- TypeScript logic code should not be in index.ts files.
- Strict compiler flags and linting (ESlint for TypeScript) should be implemented and followed.
- Bias towards small, readable methods with no more than 3 levels of nesting and no more than 70 lines in length.
- Avoid over complexity and too much boiler plate code. This is a demo focused on the load balancer semantics. We don't want to make it hard to read due to lots of mechanical code that isn't our core logic.

### Directory layout

`.ai/plans/` contains plan mode artifacts
`.ai/skills/` contains any AI agent skills added to the project
`docs/` contains documents related to the project like the Claude prompt log, and project background
`lb/` contains code for the load balancer
`lb/sidcar/` contains the code for the sidecar process
`services/<service name>/` contains our demo servers
`generator/` contains the load generator
`web/` contains the web server

