// ========================= Put socket.io logic here ==============================

var socket = io.connect();

// handle the changedDocument event
socket.on("changedDocument", function(docString) {
    var document;
    if (typeof docString == "string") {
        document = JSON.parse(docString);
    }
    else if (typeof docString == "object") {
        document = docString;
    }
    else {
        console.log("Wrong type for docString");
        return;
    }
    // get my current username

    if (document.forUser !== $(domTargets.currentUserName).text().trim()) {
        return;
    }

    // add to my list of documents in my session
    $.ajax({
        type: "POST",
        url: "/reloadsession",
        data: {
            "document": document
        },
        success: function(response) {
            // update alerts
            updateAlerts(response);

            // redisplay documents
            $(domTargets.documentList).empty();
            response.userDocuments.forEach(function(item, index) {
                
                
                $(domTargets.documentList).append(domTargets.singleDocEntry(item));
                
                item.subDocs.forEach(function(subDoc, index) {
                    $('[data-doc-id="' + subDoc.projectId + '"] ul').append(domTargets.singleSubDocEntry(subDoc));
                });
            });
        }
    });
});


socket.on("addedSubDoc", function(subDocString) {
    console.log("addSubDoc Called");
    var subDoc = JSON.parse(subDocString);
    if (subDoc.generatedByUser ===  $(domTargets.currentUserName).text().trim()) {
        return;    
    }    
    $('li[data-doc-id]').each( function(index){
        var id = $(this).attr('data-doc-id').trim();
        if (id === subDoc.projectId) {
            if ( $('li[data-subDoc-id="' + subDoc.id + '"]').length === 0 ){
                $('[data-doc-id="'+ id +'"] ul').append(domTargets.singleSubDocEntry(subDoc));
            }
        }        
    });
});


// handle the newMessage event
socket.on("newMessage", function(messageStr) {
    var message = JSON.parse(messageStr);
    
    if (message.toUser !== $(domTargets.currentUserName).text().trim()) {
	return;
    }
    
    // notify user instantly of message
    var response = {infos:[], errors:[]};
    response.infos.push("You have a new message from " + message.fromUser 
			+ " about the document " + message.documentName + "."
			+ " Check your mail for more details!");
    updateAlerts(response);
});

// handle the savedDocument event 
socket.on("savedDocument", function(messageStr) {
    var message = JSON.parse(messageStr);

    if (message.sharesWith.indexOf($(domTargets.currentUserName).text().trim()) != -1) {
	    updateLastSavedInfo(jQuery.timeago(new Date(message.lastModified)));
    }
});

// =================================================================================

