/************************************************************************
* Copyright 2016 IBM Corp. All Rights Reserved.
*
* Watson Maker Kits
*
* This project is licensed under the Apache License 2.0, see LICENSE.*
*
************************************************************************
*
* Build a talking robot with Watson.
* This module uses Watson Speech to Text, Watson Conversation, and Watson Text to Speech.
* To run: node conversation.js

* Follow the instructions in http://www.instructables.com/id/Build-a-Talking-Robot-With-Watson-and-Raspberry-Pi/ to
* get the system ready to run this code.
*/

var watson = require('watson-developer-cloud'); //to connect to Watson developer cloud
var config = require("./config.js") // to get our credentials and the attention word from the config.js files
var exec = require('child_process').exec;
var fs = require('fs');
var conversation_response = "";
var attentionWord = config.attentionWord; //you can change the attention word in the config file

/************************************************************************
* Step #1: Configuring your Bluemix Credentials
************************************************************************
In this step we will be configuring the Bluemix Credentials for Speech to Text, Watson Conversation
and Text to Speech services.
*/

var speech_to_text = watson.speech_to_text({
  username: config.STTUsername,
  password: config.STTPassword,
  version: 'v1'
});

var conversation = watson.conversation({
  username: config.ConUsername,
  password: config.ConPassword,
  version: 'v1',
  version_date: '2016-07-11'
});

var text_to_speech = watson.text_to_speech({
  username: config.TTSUsername,
  password: config.TTSPassword,
  version: 'v1'
});

/************************************************************************
* Step #2: Configuring the Microphone
************************************************************************
In this step, we configure your microphone to collect the audio samples as you talk.
See https://www.npmjs.com/package/mic for more information on
microphone input events e.g on error, startcomplete, pause, stopcomplete etc.
*/

// Initiate Microphone Instance to Get audio samples
var mic = require('mic');
var micInstance = mic({ 'rate': '44100', 'channels': '2', 'debug': false, 'exitOnSilence': 6 });
var micInputStream = micInstance.getAudioStream();

micInputStream.on('data', function(data) {
  //console.log("Recieved Input Stream: " + data.length);
});

micInputStream.on('error', function(err) {
  console.log("Error in Input Stream: " + err);
});

micInputStream.on('silence', function() {
  // detect silence.
});
micInstance.start();
console.log("TJBot is listening, you may speak now.");

var textStream ;

/************************************************************************
* Step #3: Converting your Speech Commands to Text
************************************************************************
In this step, the audio sample is sent (piped) to "Watson Speech to Text" to transcribe.
The service converts the audio to text and saves the returned text in "textStream"
You can also set the language model for your speech input.
The following language models are available
    ar-AR_BroadbandModel
    en-UK_BroadbandModel
    en-UK_NarrowbandModel
    en-US_BroadbandModel (the default)
    en-US_NarrowbandModel
    es-ES_BroadbandModel
    es-ES_NarrowbandModel
    fr-FR_BroadbandModel
    ja-JP_BroadbandModel
    ja-JP_NarrowbandModel
    pt-BR_BroadbandModel
    pt-BR_NarrowbandModel
    zh-CN_BroadbandModel
    zh-CN_NarrowbandModel
*/

var recognizeparams = {
  content_type: 'audio/l16; rate=44100; channels=2',
  interim_results: true,
  keywords: [attentionWord],
  smart_formatting: true,
  keywords_threshold: 0.5,
  model: 'en-US_BroadbandModel'  // Specify your language model here
};


textStream = micInputStream.pipe(speech_to_text.createRecognizeStream(recognizeparams));

textStream.setEncoding('utf8');

/*********************************************************************
* Step #4: Parsing the Text and create a response
*********************************************************************
In this step, we parse the text to look for attention word and send that sentence
to watson conversation to get appropriate response. You can change it to something else if needed.
Once the attention word is detected,the text is sent to Watson conversation for processing. The response is generated by Watson Conversation and is sent back to the module.
*/
var context = {} ; // Save information on conversation context/stage for continous conversation
textStream.setEncoding('utf8');
textStream.on('data', function(str) {
  console.log(' ===== Speech to Text ===== : ' + str); // print the text once received

  if (str.toLowerCase().indexOf(attentionWord.toLowerCase()) >= 0) {
    var res = str.toLowerCase().replace(attentionWord.toLowerCase(), "");
    console.log("msg sent to conversation:" ,res);
    conversation.message({
      workspace_id: config.ConWorkspace,
      input: {'text': res},
      context: context
    },  function(err, response) {
      if (err) {
        console.log('error:', err);
      } else {
        context = response.context ; //update conversation context
        conversation_response =  response.output.text[0]  ;
        if (conversation_response != undefined ){
          var params = {
            text: response.output.text[0],
            voice: config.voice,
            accept: 'audio/wav'
          };

          console.log("Result from conversation:" ,conversation_response);
          /*********************************************************************
          Step #5: Speak out the response
          *********************************************************************
          In this step, we text is sent out to Watsons Text to Speech service and result is piped to wave file.
          Wave files are then played using alsa (native audio) tool.
          */
          tempStream = text_to_speech.synthesize(params).pipe(fs.createWriteStream('output.wav')).on('close', function() {
            var create_audio = exec('aplay output.wav', function (error, stdout, stderr) {
              if (error !== null) {
                console.log('exec error: ' + error);
              }
            });
          });
        }else {
          console.log("The response (output) text from your conversation is empty. Please check your conversation flow \n" + JSON.stringify( response))
        }

      }

    })
  } else {
    console.log("Waiting to hear", attentionWord);
  }
});

textStream.on('error', function(err) {
  console.log(' === Watson Speech to Text : An Error has occurred =====') ; // handle errors
  console.log(err) ;
  console.log("Press <ctrl>+C to exit.") ;
});
