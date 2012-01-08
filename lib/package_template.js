(function() {

  var root = this

  var ros = null
  var <%= packageName %> = null
  if (typeof exports !== 'undefined') {
    ros = require('<%= options.rosnodejsDir || 'rosnodejs' %>')
    <%= packageName %> = exports
  }
  else {
    ros = root.ros
    <%= packageName %> = root.<%= packageName %> = {}
  }

<% for (var i = 0; i < messageDefinitions.length; i++) { 
     var templatedMessage      = templatedMessages[i];
     var messageDefinition     = messageDefinitions[i];
     var messageType           = messageDefinition.messageType;
     var messageTypeComponents = messageType.split('/');
     var messageName           = messageTypeComponents[1];
%>
  <%= packageName %>.<%= messageName %> = <%= templatedMessage %>
<% } %>

}).call(this)

