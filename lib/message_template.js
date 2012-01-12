<%
  /*
   * As new lines and spaces are strictly interpreted by the templater, some
   * formatting of this template has been sacrificed for the prettiness of the
   * code it generates.
   */
%>ros.Message.extend({
    defaults: {
      "fields" : <%= JSON.stringify(fields) %>
    , "fieldTypes" : <%= JSON.stringify(fieldTypes) %>
    <% for (var i = 0; i < fields.length; i++) { var fieldName = fields[i]; %>, "<%= fieldName %>" : <%= JSON.stringify(fieldDefaults[fieldName]) %><% } %>
    , "type" : <%= JSON.stringify(messageType) %>
    , "md5sum" : <%= JSON.stringify(md5sum) %>
    }<% if (Object.keys(fieldMessages).length > 0) { %>
  , initialize: function(attributes) {<% for (var i = 0; i < fields.length; i++) {
        var fieldName = fields[i];
        var fieldMessage = fieldMessages[fieldName];
        var fieldDefault = fieldDefaults[fieldName];
        if (fieldMessage && !(fieldDefault instanceof Array)) { %>
      var <%= fieldName %> = this.get("<%= fieldName %>")
      if (!<%= fieldName %> || !(<%= fieldName %> instanceof ros.Message)) {
        var <%= fieldName %>Message = this.getMessageForField("<%= fieldName %>")
        this.set({
          <%= fieldName %>: new <%= fieldName %>Message(<%= fieldName %>)
        })
      }<% } else if (fieldMessage && (fieldDefault instanceof Array)) { %>
      var <%= fieldName %> = this.get("<%= fieldName %>")
      if (<%= fieldName %> instanceof Array) {
        var <%= fieldName %>Array = []
        for (var <%= fieldName %>Index = 0; <%= fieldName %>Index < <%= fieldName %>.length; <%= fieldName %>Index++) {
          var <%= fieldName %>Value = <%= fieldName %>[<%= fieldName %>Index]
          if (!(<%= fieldName %>Value instanceof ros.Message)) {
            var <%= fieldName %>Message = this.getMessageForField("<%= fieldName %>")
            <%= fieldName %>Array.push(new <%= fieldName %>Message(<%= fieldName %>Value))
          }
        }
        if (<%= fieldName %>Array.length > 0) {
          this.set({
            <%= fieldName %>: <%= fieldName %>Array
          })
        }
      }<% } } %>
    }
  , getMessageForField: function(fieldName) {
      var Message = null<% for (var i = 0; i < fields.length; i++) {
        var fieldName = fields[i];
        var templatedFieldMessage = templatedFieldMessages[fieldName];
        if (templatedFieldMessage) { %>
      <% if (i > 0) { %>else <% } %>if (fieldName === "<%= fieldName %>") {
        Message = <%= templatedFieldMessage %>
      }<% } } %>
      return Message
    }<% } %>
  })
