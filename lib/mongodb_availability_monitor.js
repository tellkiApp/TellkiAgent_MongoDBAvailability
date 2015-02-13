/*
 This script was developed by Guberni and is part of Tellki's Monitoring Solution

 February, 2015
 
 Version 1.0

 DEPENDENCIES:
		mongodb v2.0.15 (https://www.npmjs.com/package/mongodb)
 
 DESCRIPTION: Monitor MongoDB Avalability utilization

 SYNTAX: node mongodb_availability_monitor.js <METRIC_STATE> <HOST> <PORT> <USER_NAME> <PASS_WORD>
 
 EXAMPLE: node mongodb_availability_monitor.js "1,1" "10.10.2.5" "27017" "user" "pass"

 README:
		<METRIC_STATE> is generated internally by Tellki and it's only used by Tellki default monitors.
		1 - metric is on ; 0 - metric is off

		<HOST> MongoDB ip address or hostname.
		
		<PORT> MongoDB port
		
		<USER_NAME>, <PASS_WORD> are only required if configured. If you want to use this
 		script to monitor a non password protected mongodb, leave this parameters empty ("") but you still need to
		pass them to the script.

*/

//METRICS IDS
var statusId = "36:Status:9";
var responseTimeId = "112:Response Time:4";

//MongoDB usage
var mongodb = "local";
var command = "serverStatus";

// ############# INPUT ###################################

//START
(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidAuthenticationError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)


/*
* Verify number of passed arguments into the script.
*/
function monitorInput(args)
{
	if(args.length == 5)
	{
		monitorInputProcess(args);
	}
	else
	{
		throw new InvalidParametersNumberError()
	}
}


/*
* Process the passed arguments and send them to monitor execution (monitorDatabaseAvailability)
* Receive: arguments to be processed
*/
function monitorInputProcess(args)
{
	//<METRIC_STATE> 
	var metricState = args[0].replace("\"", "");
	
	var tokens = metricState.split(",");

	var metricsExecution = new Array(2);
	
	for(var i in tokens)
	{
		metricsExecution[i] = (tokens[i] === "1")
	}
	
	//<HOST>
	var hostname = args[1];
	
	// <PORT> 
	var port = args[2];
	
	
	// <USER_NAME> 
	var username = args[3];

	username = username.length === 0 ? "" : username;
	username = username === "\"\"" ? "" : username;
	if(username.length === 1 && username === "\"")
		username = "";
	
	// <PASS_WORD>
	var passwd = args[4];
	passwd = passwd.length === 0 ? "" : passwd;
	passwd = passwd === "\"\"" ? "" : passwd;
	if(passwd.length === 1 && passwd === "\"")
		passwd = "";
	
	
	//create connection URI
	var connectionURI = "";

	if (username.length === 0)
	{
		if (port.length === 0)
		{
			connectionURI = "mongodb://" + hostname;
		}
		else
		{
			connectionURI = "mongodb://" + hostname + ":" + port;
		}
	}
	else
	{
		if (port.length === 0)
		{
			connectionURI = "mongodb://" + username + ":" + passwd + "@" + hostname;
		}
		else
		{
			connectionURI = "mongodb://" + username + ":" + passwd + "@" + hostname + ":" + port;
		}
	}
	
	
	//create request object to be executed
	var requests = []
	
	var request = new Object();
	request.connectionURI = connectionURI+"/"+mongodb;
	request.metricsExecution = metricsExecution;
	
	requests.push(request);

	//call monitor
	monitorDatabaseAvailability(requests);
	
}





// ################# MONGODB AVAILABILITY CHECK  ###########################
/*
* Retrieve metrics information
* Receive: object request containing configuration
*/
function monitorDatabaseAvailability(requests) 
{
	var mongodb = require('mongodb');
	
	//Create mongoDB client
	var MongoClient = mongodb.MongoClient
	
	for(var i in requests)
	{
		var request = requests[i];
		
		var start = Date.now();

		//try connection
		MongoClient.connect(request.connectionURI, function(err, db) {

			if (err && err.message === "auth failed") 
			{
				errorHandler(new InvalidAuthenticationError());
			}
			else if(err)
			{
				// output status set to 0
				processMetricOnError(request, start)
				return;
			}
			
			//run command to confirm real connection
			db.command({serverStatus:1}, function(err, result) {
				
				if(err)
				{
					// output status set to 0
					processMetricOnError(request, start)
					return;
				}

				// output metrics
				processMetricOnSuccess(request, start)

				db.close();
			});
		});
	}
}

//################### OUTPUT METRICS ###########################

/*
* Send metrics to console
* Receive: metrics list to output
*/
function output(metrics)
{
	for(var i in metrics)
	{
		var out = "";
		var metric = metrics[i];
		
		out += metric.id;
		out += "|";
		out += metric.val
		out += "|";
		
		console.log(out);
	}
}

/*
* Process metrics on error.
* Receive:
* - object request to output info 
* - start time, to calculate execution time
*/
function processMetricOnError(request, start)
{
	if(request.metricsExecution[0])
	{
		var metrics = [];
		
		var metric = new Object();
		metric.id = statusId;
		metric.val = 0;
		metric.ts = start;
		metric.exec = Date.now() - start;

		metrics.push(metric);

		output(metrics);
	}
}

/*
* process metrics on success
* Receive: 
* - object request to output info
* - start time, to calculate execution time and response time
*/
function processMetricOnSuccess(request, start)
{	
	var metrics = [];
	
	if(request.metricsExecution[0])
	{
		var metric = new Object();
		metric.id = statusId;
		metric.val = 1;
		metric.ts = start;
		metric.exec = Date.now() - start;

		metrics.push(metric);
	}
	
	if(request.metricsExecution[1])
	{
		var metric = new Object();
		metric.id = responseTimeId;
		metric.val = Date.now() - start;
		metric.ts = start;
		metric.exec = Date.now() - start;

		metrics.push(metric);
	}
	
	output(metrics);	
}


//################### ERROR HANDLER #########################
/*
* Used to handle errors of async functions
* Receive: Error/Exception
*/
function errorHandler(err)
{
	if(err instanceof InvalidAuthenticationError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	else
	{
		console.log(err.message);
		process.exit(1);
	}
}


//####################### EXCEPTIONS ################################

//All exceptions used in script

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function InvalidAuthenticationError() {
    this.name = "InvalidAuthenticationError";
    this.message = "Invalid authentication.";
	this.code = 2;
}
InvalidAuthenticationError.prototype = Object.create(Error.prototype);
InvalidAuthenticationError.prototype.constructor = InvalidAuthenticationError;
