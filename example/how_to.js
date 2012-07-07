var path   = require('path')
  , fs     = require('fs')
  , exec   = require('child_process').exec
  , should = require('should')

describe('How to use rosmsgjs', function() {

  it('to generate JavaScript models for message types', function(done) {
    // A message type in ROS defines a set of fields a message will contain.
    //
    // A ROS package will usually define a collection of message types. For
    // example, the std_msgs package defines message types for a set of basic
    // data types, like std_msgs/String and std_msgs/Int32.
    //
    // To make it easier to use message types in JavaScript, rosmsgjs can
    // generate JavaScript models for representing each message type.

    // The `rosmsg generate` command will generate a JavaScript file containing
    // objects for all the message types in the std_msgs package.
    var rosmsgjsBin = '"' + __dirname + '/../bin/rosmsgjs"'
    var generateCommand = rosmsgjsBin + ' generate std_msgs'

    // Execute the rosmsgjs command to generate the file. Generating a file can
    // take a little while, so the allocated time for the test is extended.
    this.timeout(30000)
    var child = exec(generateCommand, function(error, stdout, stderr) {
      should.not.exist(error)

      // The file generated defaults to the package name with a .js extension.
      // An alternative file name can be provided with the `--output` option.
      fs.existsSync('./std_msgs.js').should.be.true

      // Remove the generated file from testing.
      fs.unlinkSync('./std_msgs.js')

      done(error)
    })
  })
})
