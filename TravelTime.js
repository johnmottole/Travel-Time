"use strict";

//Creates speech response
function makeSpeechletResponse (outputText, shouldEndSession) {

  return {
    outputSpeech: {
      type: "PlainText",
      text: outputText
    },
    shouldEndSession: shouldEndSession
  };

}

//Creates response 
function generateResponse (speechletResponse,theInfo) {

  return {
    version: "1.0",
    sessionAttributes: {info: theInfo},
    response: speechletResponse
  };

}

//Asks user for more information and calls processing function when has all information needed
function getMoreInfo(event, context)
{
    //New Session, does not have any data
    if (event.session.new)
    {
        context.succeed(speak("Welcome to travel time. I first need some information about where you are going. What state is your destination in?", false,[]));
    } 
    //Does not have data, user had asked for help during the session
    else if (event.session.attributes.info.length === 0 && event.request.intent.name == "Continue")
    {
        context.succeed(speak("What state is your destination in?", false,[]));
    }
    //Gets session data
    var info = event.session.attributes.info;
    //Check if intent is to give more data, and if so add it
    if (event.request.intent.name != "Continue")
    {
        var newInfo = "";
        if (event.request.intent.name == "GetState")
        {
            newInfo = event.request.intent.slots.State.value;
        } else {                    
            newInfo = event.request.intent.slots.City.value;
        }
        info.push(newInfo);
    }
    var response = "";
    //Repsond based on data available, if there is four items, process the data and give the user their repsonse
    switch(info.length){
        case 1:
            response = "Ok, what is the city of your destination?";
            context.succeed(speak(response,false,info));
            break;
        case 2:
            response = "Ok, what state are you leaving from?";
            context.succeed(speak(response,false,info));
            break;
        case 3:
            response = "Ok, what city are you leaving from?";                            
            context.succeed(speak(response,false,info));
            break;
        case 4:
            processAndRespond(info,context);
            break;
        default:
            context.succeed(speak("I'm sorry, something went wrong",true,info));
        }
                
}


//Speak function, creates a response after being passed a message to the user, a boolean variable indicating whether to end the session, and the data from the session
function speak (text,finished,info) {
    return generateResponse(makeSpeechletResponse(text,finished),info);
    
}

//Called once user has given all the data
function processAndRespond(info, context)
{   
    
    //Clean data to send to Google Maps API
    var i;
    for (i = 0;i<4;i++)
    {
        info[i] = info[i].trim();
        info[i] = info[i].split(' ').join('+');
    }
    
    //Send data to Google Maps API
    let destination = info[1] + "," + info[0];
    let origin = info[3] + "," + info[2];
    let url = 'https://maps.googleapis.com/maps/api/distancematrix/json?units=imperial&origins=' + origin + '&destinations=' + destination + '&traffic_model=best_guess&departure_time=now&key=XXXXX';
    
    //Process Google Maps Response
    var https = require('https');
    https.get(url, function(res) {
        let rData = '';
        res.on('data', (chunk) => rData += chunk);
        res.on('end', () => {
        try {
            let parsedData = JSON.parse(rData);
            let theTime = parsedData.rows[0].elements[0].duration_in_traffic.text;
            let theDestination = parsedData.destination_addresses.toString();
            let theOrigin = parsedData.origin_addresses.toString();
            
            //Remove ', USA' from destination
            if (theDestination.substring(theDestination.length-5,theDestination.length))
            {
                theDestination = theDestination.substring(0,theDestination.length-5);
            }
            
            //Remove zip code from destination if has one
            if (!isNaN(theDestination.substring(theDestination.length-5,theDestination.length)))
            {
                theDestination = theDestination.substring(0,theDestination.length-5);
            }
            
            //Remove ', USA' from origin
            if (theOrigin.substring(theOrigin.length-5,theOrigin.length))
            {
                theOrigin = theOrigin.substring(0,theOrigin.length-5);
            }
            
            //Remove zip code from origin if has one
            if (!isNaN(theOrigin.substring(theOrigin.length-5,theOrigin.length)))
            {
                theOrigin = theOrigin.substring(0,theOrigin.length-5);
            }

            let response = "It will take approximently " + theTime + " to get from " + theOrigin + " to " + theDestination +" if you leave now";
            context.succeed(speak(response, true, []));
        } catch (e) {
            context.succeed(speak("I'm sorry, something went wrong", true, []));
        }
        });
    });
    
    
}


exports.handler = (event, context) => {
    try {
        //Check for correct app ID
        if (event.session.application.applicationId != "XXXXX") 
        {
            context.succeed(speak("Invalid Application ID",true,[]));
        }
        //Session Ended Request Implementation
        else if (event.request.type == "SessionEndedRequest")
        {
            context.succeed();
        }
        //Intent Requests
        else if (event.request.type == "IntentRequest") {
            if (event.request.intent.name == "GetState" || event.request.intent.name == "GetCity")
            {
                getMoreInfo(event,context);
            }
            else if (event.request.intent.name == "AMAZON.StopIntent") {
                context.succeed(speak("",true,[]));
            }
            else if (event.request.intent.name == "AMAZON.HelpIntent") {
                var info = event.session.attributes.info;
                context.succeed(speak("Travel time allows you to estimate the time your trip will take. Simply answer the questions about your trip and get a quick response. To continue say continue, otherwise say stop.",false,info));
            }
            else if (event.request.intent.name == "AMAZON.CancelIntent")
            {
                context.succeed(speak("",true,[]));
            }
            else if (event.request.intent.name == "Continue") {
                getMoreInfo(event,context);
            }
        }
        //If new session but no intent given
        else if (event.session.new)
        {
            getMoreInfo(event,context);
        }
    } catch(error) { 
        context.succeed(speak("I'm sorry, something went wrong",true,[]));
        console.log(error)
    }

};