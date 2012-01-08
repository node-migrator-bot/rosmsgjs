// Generates browser and Node.js compatible JavaScript models from ROS message
// definitions. Can process all the message definitions for a package or a
// single message definition.
var fs         = require('fs')
  , util       = require('util')
  , exec       = require('child_process').exec
  , underscore = require('underscore')
  , async      = require('async')
  , fields     = require('rosnodejs/lib/fields')

var generator = exports

// Given a list of message definitions, returns the browser and
// Node.js compatible JavaScript models as a string.
//
// Parameters:
//  * packageName        - The package name all the messages belong to.
//  * messageDefinitions - Array of message definitions. The array can be
//    created from `createFromPackage`.
//  * options            - Object with templating options. Options include:
//    * rosnodejsDir - Path to use for requiring the rosnodejs module in
//      node.js. Defaults to 'rosnodejs'.
generator.templatePackage = function(packageName, messageDefinitions, options, callback) {

  // Reads the template file for outputting a message object.
  fs.readFile(__dirname + '/message_template.js', 'utf8', function(error, messageTemplate) {
    if (error) {
      callback(error)
    }
    else {
      // Templates each message definition.
      var templatedMessages = []
      for (var i = 0; i < messageDefinitions.length; i++) {
        var messageDefinition = messageDefinitions[i]
        var templatedMessage  = templateMessage(messageDefinition, messageTemplate)
        templatedMessages.push(templatedMessage)
      }

      // Reads the template file for outputting the package.
      fs.readFile(__dirname + '/package_template.js', 'utf8', function(error, packageTemplate) {
        if (error) {
          callback(error)
        }
        else {
          // Templates the package with all the templated messages too.
          var packageOutput = underscore.template(packageTemplate, {
            packageName        : packageName
          , messageDefinitions : messageDefinitions
          , templatedMessages  : templatedMessages
          , options            : options
          })

          callback(error, packageOutput)
        }
      })
    }
  })
}

// Templates a message definition.
function templateMessage(messageDefinition, template) {

  // To output prettier message fields, indents the template.
  var splitTemplate    = template.split('\n')
    , indentedTemplate = '\n'
  for (var i = 0; i < splitTemplate.length; i++) {
    // Ignore whitespace only lines.
    var line = splitTemplate[i]
    if (/\S/.test(line)) {
      indentedTemplate += '      ' + line + '\n'
    }
  }

  // Templates any message type fields recursively.
  for (var fieldName in messageDefinition.fieldMessages) {
    var fieldMessageDefinition = messageDefinition.fieldMessages[fieldName]
    var templatedFieldMessage  = templateMessage(fieldMessageDefinition, indentedTemplate)
    templatedFieldMessage  = templatedFieldMessage.trim()

    messageDefinition.templatedFieldMessages[fieldName] = templatedFieldMessage
  }

  // Templates the message definition.
  return underscore.template(template, messageDefinition)
}

// Processes all the message types in a package and returns the processed
// message definition objects in the callback.
generator.createFromPackage = function(packageName, callback) {
  var that = this

  getAllMessageTypes(packageName, function(error, messageTypes) {
    if (error) {
      callback(error)
    }
    else {
      generator.createFromMessageTypes(messageTypes, callback)
    }
  })
}

// Processes all the message definitions for the passed in message types and
// returns the processed message definition objects in the callback.
generator.createFromMessageTypes = function(messageTypes, callback) {
  // Define a message based on the message type.
  var defineMessageType = function(messageType, callback) {
    generator.createFromMessageType(messageType, function(error, messageDefinition) {
      if (error) {
        callback(error)
      }
      else {
        messageDefinitions.push(messageDefinition)
        callback()
      }
    })
  }

  // Process each message type.
  var messageDefinitions = []
  async.forEach(messageTypes, defineMessageType, function(error) {
    callback(error, messageDefinitions)
  })
}

// Process the message definition for a given message type and returns the
// processed message in the callback. The processed message structure provides a
// format that's easier to theme for output.
generator.createFromMessageType = function(messageType, callback) {
  var that = this

  getMessageDefinition(messageType, function(error, definition) {
    that.createFromDefinition(definition, function(error, messageDefinition) {
      messageDefinition.messageType = messageType

      // Adds the MD5 sum for the message.
      getMessageMd5Sum(messageType, function(error, md5sum) {
        if (error) {
          callback(error)
        }
        else {
          messageDefinition.md5sum = md5sum
          callback(error, messageDefinition)
        }
      })
    })
  })
}

// Parses the message definition file and builds up the basic structure for a
// message definition object.
generator.createFromDefinition = function(definition, callback) {
  // The message definition object contains the raw values needed by the
  // templater for generating code.
  var messageDefinition = {
    // List of field names, ordered based on the message definition.
    fields: []
    // Mapping of field names to the field type (like uint32, geometry_msgs/Twist).
  , fieldTypes: {}
    // Mapping of field names to their defaults.
  , fieldDefaults: {}
    // Mapping of message fields to their message definition. Example,
    // "std_msgs/String foo" would map foo to std_msgs/String. Includes message
    // arrays, like "std_msgs/String[] bar" would map bar to std_msgs/String.
  , fieldMessages: {}
    // Similar to fieldMessages, but maps the message field to the templated
    // message.
  , templatedFieldMessages: {}
    // Placeholder for the message type (e.g. std_msgs/MultiArrayLayout).
  , messageType: null
    // Placeholder for the MD5 sum.
  , md5sum: null
  }

  // Reads the message definition line by line.
  var lines = definition.split('\n')
  for (var i = 0; i < lines.length; i++) {
    // Line format:
    // type name
    // or
    // type name=value
    var line            = lines[i].trim()
      , lineComponents  = line.split('=', 2)
      , fieldComponents = lineComponents[0].split(' ', 2)
      , fieldType       = fieldComponents[0]
      , fieldName       = fieldComponents[1]

    // Ignores empty or malformed field lines.
    if (fieldName !== undefined) {
      messageDefinition.fields.push(fieldName)

      // Sets the field's type. Header is a special field type as it maps to
      // std_msgs/Header.
      if (fieldType === 'Header') {
        fieldType = 'std_msgs/Header'
      }
      messageDefinition.fieldTypes[fieldName] = fieldType

      // Assigns the default value for the field based on field type.
      // If a constant value was specified, uses the constant.
      if (lineComponents.length > 1) {
        var rawFieldValue = lineComponents[1].trim()
        var fieldValue = fields.parseField(fieldType, rawFieldValue)
        messageDefinition.fieldDefaults[fieldName] = null
      }
      // If an array field, initializes an empty array.
      else if (fields.isArray(fieldType)) {
        messageDefinition.fieldDefaults[fieldName] = []
      }
      // Defaults field to a null value.
      else {
        messageDefinition.fieldDefaults[fieldName] = null
      }

      // Message fields and array message fields are queued up to be processed
      // later.
      if (fields.isMessageType(fieldType)) {
        messageDefinition.fieldMessages[fieldName] = null
      }
      else if (fields.isArray(fieldType)) {
        var arrayFieldType = fields.getFieldTypeOfArray(fieldType)
        if (fields.isMessageType(arrayFieldType)) {
          messageDefinition.fieldMessages[fieldName] = null
        }
      }
    }
  }

  // Message fields need further processing.
  var defineFieldMessage = function(fieldName, callback) {
    // Gets the message type of the field.
    var messageType = messageDefinition.fieldTypes[fieldName]
    if (fields.isArray(messageType)) {
      messageType = fields.getFieldTypeOfArray(messageType)
    }

    // Defines the message field.
    generator.createFromMessageType(messageType, function(error, fieldMessageDefinition) {
      messageDefinition.fieldMessages[fieldName] = fieldMessageDefinition
      callback()
    })
  }

  // Defines any message fields and returns once everything has been processed.
  var fieldMessageNames = Object.keys(messageDefinition.fieldMessages)
  async.forEach(fieldMessageNames, defineFieldMessage, function(error) {
    callback(error, messageDefinition)
  })
}

// Fetches all the message types defined in a package.
function getAllMessageTypes(packageName, callback) {
  var packageCommand = 'rosmsg package ' + packageName
  var child = exec(packageCommand, function (error, stdout, stderr) {
    if (error) {
      callback(error)
    }
    else {
      var cleanedOutput = cleanText(stdout)
        , messageTypes  = cleanedOutput.split('\n')
      callback(error, messageTypes)
    }
  })
}

// Gets the message definition verbatim from the message file.
function getMessageDefinition(messageType, callback) {
  var showMessageCommand = 'rosmsg show ' + messageType
  var child = exec(showMessageCommand, function (error, stdout, stderr) {
    var cleanedOutput = cleanText(stdout)
    callback(error, cleanedOutput)
  })
}

// Calculates the MD5 sum of a message type.
function getMessageMd5Sum(messageType, callback) {
  var md5SumCommand = 'rosmsg md5 ' + messageType
  var child = exec(md5SumCommand, function (error, stdout, stderr) {
    var cleanedOutput = cleanText(stdout)
    callback(error, cleanedOutput)
  })
}

// Removes empty lines and inner message definitions.
//
// Example message definition input:
//   geometry_msgs/Vector3 linear
//     float64 x
//     float64 y
//     float64 z
//
// The cleaned up output:
//   geometry_msgs/Vector3 linear
function cleanText(text) {
  var validLines = []
  var lines = text.split('\n')
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    // Ignores fields for inner message definitions.
    if (line[0] !== ' ') {
      // Removes empty lines.
      line = line.trim()
      if (line.length > 0) {
        validLines.push(line)
      }

    }
  }
  var cleanedText = validLines.join('\n')

  return cleanedText
}

