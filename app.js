var Twitter = require('twitter');
var ToneAnalyzerV3 = require('watson-developer-cloud/tone-analyzer/v3');
var express = require('express');
var path = require('path');
var app = express();
var Cloudant = require('@cloudant/cloudant');
var cloudantDets = {
  "username": "efe71597-a6f6-43af-ab51-02ce0c68471c-bluemix",
  "password": "180e2db976ef70fddf96385170063da9225747c774e3785eb648815dcb0ce417",
  "host": "efe71597-a6f6-43af-ab51-02ce0c68471c-bluemix.cloudant.com",
  "port": 443,
  "url": "https://efe71597-a6f6-43af-ab51-02ce0c68471c-bluemix:180e2db976ef70fddf96385170063da9225747c774e3785eb648815dcb0ce417@efe71597-a6f6-43af-ab51-02ce0c68471c-bluemix.cloudant.com"
};
// app.use(bodyParser.json());
// app.use(bodyParser.urlencoded({ extended: true }));

app.listen(process.env.PORT || 8080, function () {
  console.log("Listening on port 8080");
});

app.get('/getData', function (req, res) {
  var db = cloudant.db.use('scores');
  var scores = [];
  var tmp;
  db.list({include_docs:true}, function (err, data) {
    data.rows.forEach(function (row) {
      scores.push([row.doc.datetime, row.doc.score]);
    });
    var sortedScores = scores.sort(function(a, b) {
      return parseInt(a[0]) - parseInt(b[0]);
    });
    // console.log(JSON.stringify(sortedScores, null, 2));
    res.status(200).end(JSON.stringify(sortedScores));
  });
});


app.get('/', function(req, res) {
  res.sendFile(path.resolve(__dirname + '/index.html'));
});

app.get('/:file', function(req, res) {
  res.sendFile(path.resolve(__dirname + '/' + req.params.file));
});


var cloudant = Cloudant(cloudantDets.url, function (er, cloudant, reply) {
  if (er) {
    throw er;
  }
  console.log(JSON.stringify(reply));
});

var client = new Twitter({
  consumer_key: '51HtzK32GVwg1hcg9cL2Mh9eH',
  consumer_secret: 'D4Vx9LIKdy4poS9Q8DbOyIcK9z0zY561buFYEdAfBBZpNXTgYO',
  access_token_key: '991376790538121218-3AV2fLH3IqYW0tmfqByRws4yyd98j8k',
  access_token_secret: 'tp8Yoh0P2VlxLymlukuhlfBvV9nW8fSYLIW9M4pRLKm55'
});

var sentAlUser="76e8dbf1-a95c-41b0-94f2-a1881f75222e";
var sentAlPass="JLPZTXIHYFuD";

var toneAnalyzer = new ToneAnalyzerV3({
  username: sentAlUser,
  password: sentAlPass,
  version: '2016-05-19',
  url: 'https://gateway.watsonplatform.net/tone-analyzer/api/'
});


function analyse() {
  var previousDatestamp = 0;
  var db = cloudant.db.use('scores');
  var scores = [];
  var avgScores = [];
  var tmp;
  db.list({include_docs:true}, function (err, data) {
    data.rows.forEach(function (row) {
      avgScores.push([row.doc.datetime, row.doc.score]);
    });
    var sortedScores = avgScores.sort(function(a, b) {
      return parseInt(a[0]) - parseInt(b[0]);
    });
    if (sortedScores.length > 0)
    {
      previousDatestamp = sortedScores[sortedScores.length-1][0];
    }
    var params = {q: '#DevoxxUK'};
    client.get('search/tweets', params, function(error, tweets, response) {
      if (error) {
        throw err;
      }
      var cons = [];
      // console.log(JSON.stringify(tweets, null, 2));
      tweets.statuses.forEach(function (tweet) {
        if (new Date(tweet.created_at).getTime() > previousDatestamp)
          cons.push(tweet.text);
      });
      console.log(cons);
      var tweet;
      var i = 0;
      // if (cons.length == 0)
      // {
      //   var time = Date.now();
      //   var data = {
      //     "datetime" : time,
      //     "score": 0
      //   };
      //   db.insert(data, function (err, result) {
      //     if (err) {
      //       throw err;
      //     }
      //     setTimeout(function () {analyse();}, 90000);
      //   });
      // } else {
        for (i = 0; i < cons.length; i++) {
          tweet = cons[i];
          console.log("Analysing: " + tweet);
          toneAnalyzer.tone({tone_input: {'text': tweet},content_type: 'application/json'}, function(err, tone) {
            if (err) {
              throw err;
            } else {
              var name;
              var score = 0;
              var cats = tone.document_tone.tone_categories[0].tones;
              cats.forEach(function (cat) {
                if (cat.score > score)
                {
                  score = cat.score;
                  name = cat.tone_name;
                }
              });
              if (name == "Joy")
              {
                scores.push(score);
              } else {
                scores.push(-1*score);
              }
              if (scores.length == cons.length)
              {
                var sum = 0;
                scores.forEach(function (score) {
                  sum += score
                });
                console.log("Average: " + sum/scores.length);
                var db = cloudant.db.use('scores');
                var time = Date.now();
                var data = {
                  "datetime" : time,
                  "score": sum/scores.length
                };
                db.insert(data, function (err, result) {
                  if (err) {
                    throw err;
                  }
                  setTimeout(function () {analyse();}, 90000);
                });
              }
            }
          });
        }
      // }
    });
  });
}

analyse()
