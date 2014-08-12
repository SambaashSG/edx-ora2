OpenAssessment.ItemUtilities = {
    /**
     Utility method for creating a unique name given a set of
     options.

     Args:
     selector (JQuery selector): Selector used to find the relative attribute
     for the name.
     nameAttribute (str): The name of the attribute that stores the unique
     names for a particular set.

     Returns:
     A unique name for an object in the collection.
     */
    createUniqueName: function(selector, nameAttribute) {
        var index = 0;
        while (index <= selector.length) {
            if (selector.parent().find("*[" + nameAttribute + "='" + index + "']").length === 0) {
                return index.toString();
            }
            index++;
        }
        return index.toString();
    },

    /**
     Format the option label, including the point value, and add it to the option.
     Relies on the data-points and data-label attributes to provide information about the option.

     Args:
     element (Jquery Element): The element that represents the object.
     **/
    refreshOptionString: function(element) {
        var points = $(element).attr('data-points');
        var label = $(element).attr('data-label');
        var name = $(element).val();
        // We don't want the lack of a label to make it look like - 1 points.
        if (label === ""){
            label = gettext('Unnamed Option');
        }
        var singularString = label + " - " + points + " point";
        var multipleString = label + " - " + points + " points";

        // If the option's name value is the empty string, that indicates to us that it is not a user-specified option,
        // but represents the "Not Selected" option which all criterion drop-downs have. This is an acceptable
        // assumption because we require name (option value) to be a unique identifier for each option.
        var finalLabel = "";
        if (name === '') {
            finalLabel = gettext('Not Selected');
        }

        // If the points are invalid, we'll be given NaN
        // Don't show this to the user.
        else if (isNaN(points)) {
            finalLabel = label;
        }

        // Otherwise, set the text of the option element to be the properly conjugated, translated string.
        else {
            finalLabel = ngettext(singularString, multipleString, points);
        }

        $(element).text(finalLabel);
    },

    /**
     Adds a class to all elements of a given type except for a single element.
     The primary use of this function is to allow paired highlighting and showing.

     Args:
        element (JQuery Element): The parent element that we want to search within
        whoToAddTo (JQuery Selector): The selector that we search for, and subsequently add the class to.
        dontAddToMe (JQuery Selector): The selector that we search for and remove the class from
        className (str): The Class of interest (is--hidden or is--faded in most contexts)
     */
    addClassToAllButOne: function(element, whoToAddTo, dontAddToMe, className){
        $(whoToAddTo, element).each(function() {
            $(this).addClass(className);
        });
        $(dontAddToMe, element).removeClass(className);
    }
};

/**
The RubricOption Class used to construct and maintain references to rubric options from within an options
container object. Constructs a new RubricOption element.

Args:
    element (OpenAssessment.Container): The container that the option is a member of.
    notifier (OpenAssessment.Notifier): Used to send notifications of updates to rubric options.

Returns:
    OpenAssessment.RubricOption
**/
OpenAssessment.RubricOption = function(element, notifier) {
    this.element = element;
    this.notifier = notifier;
    this.pointsField = new OpenAssessment.IntField(
        $(".openassessment_criterion_option_points", this.element),
        { min: 0, max: 999 }
    );
};

OpenAssessment.RubricOption.prototype = {
    /**
    Adds event listeners specific to this container item.
    **/
    addEventListeners: function() {
        // Install a focus out handler for container changes.
        $(this.element).focusout($.proxy(this.updateHandler, this));
    },

    /**
    Finds the values currently entered in the Option's fields, and returns them.

    Returns:
        object literal of the form:
        {
            'name': 'Real Bad',
            'points': 1,
            'explanation': 'Essay was primarily composed of emojis.'
        }
    **/
    getFieldValues: function () {
        var fields = {
            label: this.label(),
            points: this.points(),
            explanation: this.explanation()
        };

        // New options won't have unique names assigned.
        // By convention, we exclude the "name" key from the JSON dict
        // sent to the server, and the server will assign a unique name.
        var nameString = OpenAssessment.Fields.stringField(
            $('.openassessment_criterion_option_name', this.element)
        );
        if (nameString !== "") { fields.name = nameString; }

        return fields;
    },

    /**
    Get or set the label of the option.

    Args:
        label (string, optional): If provided, set the label to this string.

    Returns:
        string

    **/
    label: function(label) {
        var sel = $('.openassessment_criterion_option_label', this.element);
        return OpenAssessment.Fields.stringField(sel, label);
    },

    /**
    Get or set the point value of the option.

    Args:
        points (int, optional): If provided, set the point value of the option.

    Returns:
        int

    **/
    points: function(points) {
        if (points !== undefined) { this.pointsField.set(points); }
        return this.pointsField.get();
    },

    /**
    Get or set the explanation for the option.

    Args:
        explanation (string, optional): If provided, set the explanation to this string.

    Returns:
        string

    **/
    explanation: function(explanation) {
        var sel = $('.openassessment_criterion_option_explanation', this.element);
        return OpenAssessment.Fields.stringField(sel, explanation);
    },

    /**
     Hook into the event handler for addition of a criterion option.

     */
    addHandler: function (){

        var criterionElement = $(this.element).closest(".openassessment_criterion");
        var criterionName = $(criterionElement).data('criterion');
        var criterionLabel = $(".openassessment_criterion_label", criterionElement).val();
        var options = $(".openassessment_criterion_option", this.element.parent());
        // Create the unique name for this option.
        var name = OpenAssessment.ItemUtilities.createUniqueName(options, "data-option");

        // Set the criterion name and option name in the new rubric element.
        $(this.element)
            .attr("data-criterion", criterionName)
            .attr("data-option", name);
        $(".openassessment_criterion_option_name", this.element).attr("value", name);

        var fields = this.getFieldValues();
        this.notifier.notificationFired(
            "optionAdd",
            {
                "criterionName": criterionName,
                "criterionLabel": criterionLabel,
                "name": name,
                "label": fields.label,
                "points": fields.points
            }
        );
    },

    /**
     Hook into the event handler for removal of a criterion option.

     */
    removeHandler: function (){
        var criterionName = $(this.element).data('criterion');
        var optionName = $(this.element).data('option');
        this.notifier.notificationFired(
            "optionRemove",
            {
                "criterionName": criterionName,
                "name": optionName
            }
        );
    },

    /**
     Hook into the event handler when a rubric criterion option is
     modified.

     */
    updateHandler: function(){
        var fields = this.getFieldValues();
        var criterionName = $(this.element).data('criterion');
        var optionName = $(this.element).data('option');
        var optionLabel = fields.label;
        var optionPoints = fields.points;
        this.notifier.notificationFired(
            "optionUpdated",
            {
                "criterionName": criterionName,
                "name": optionName,
                "label": optionLabel,
                "points": optionPoints
            }
        );
    },

    /**
    Mark validation errors.

    Returns:
        Boolean indicating whether the option is valid.

    **/
    validate: function() {
        return this.pointsField.validate();
    },

    /**
    Return a list of validation errors visible in the UI.
    Mainly useful for testing.

    Returns:
        list of string

    **/
    validationErrors: function() {
        var hasError = (this.pointsField.validationErrors().length > 0);
        return hasError ? ["Option points are invalid"] : [];
    },

    /**
    Clear all validation errors from the UI.
    **/
    clearValidationErrors: function() {
        this.pointsField.clearValidationErrors();
    }
};

/**
The RubricCriterion Class is used to construct and get information from a rubric element within
the DOM.

Args:
    element (JQuery Object): The selection which describes the scope of the criterion.
    notifier (OpenAssessment.Notifier): Used to send notifications of updates to rubric criteria.

Returns:
    OpenAssessment.RubricCriterion
 **/
OpenAssessment.RubricCriterion = function(element, notifier) {
    this.element = element;
    this.notifier = notifier;
    this.labelSel = $('.openassessment_criterion_label', this.element);
    this.promptSel = $('.openassessment_criterion_prompt', this.element);
    this.optionContainer = new OpenAssessment.Container(
        OpenAssessment.RubricOption, {
            containerElement: $(".openassessment_criterion_option_list", this.element).get(0),
            templateElement: $("#openassessment_option_template").get(0),
            addButtonElement: $(".openassessment_criterion_add_option", this.element).get(0),
            removeButtonClass: "openassessment_criterion_option_remove_button",
            containerItemClass: "openassessment_criterion_option",
            notifier: this.notifier
        }
    );
};


OpenAssessment.RubricCriterion.prototype = {

    /**
    Invoked by the container to add event listeners to all child containers
    of this item, and add event listeners specific to this container item.
    **/
    addEventListeners: function() {
        this.optionContainer.addEventListeners();
        // Install a focus out handler for container changes.
        $(this.element).focusout($.proxy(this.updateHandler, this));
    },

    /**
    Finds the values currently entered in the Criterion's fields, and returns them.

    Returns:
        object literal of the form:
        {
            'name': 'Emoji Content',
            'prompt': 'How expressive was the author with their words, and how much did they rely on emojis?',
            'feedback': 'optional',
            'options': [
                {
                    'name': 'Real Bad',
                    'points': 1,
                    'explanation': 'Essay was primarily composed of emojis.'
                },
                ...
            ]
        }
    **/
    getFieldValues: function () {
        var fields = {
            label: this.label(),
            prompt: this.prompt(),
            feedback: this.feedback(),
            options: this.optionContainer.getItemValues()
        };

        // New criteria won't have unique names assigned.
        // By convention, we exclude the "name" key from the JSON dict
        // sent to the server, and the server will assign a unique name.
        var nameString = OpenAssessment.Fields.stringField(
            $('.openassessment_criterion_name', this.element)
        );
        if (nameString !== "") { fields.name = nameString; }

        return fields;
    },

    /**
    Get or set the label of the criterion.

    Args:
        label (string, optional): If provided, set the label to this string.

    Returns:
        string

    **/
    label: function(label) {
        return OpenAssessment.Fields.stringField(this.labelSel, label);
    },

    /**
    Get or set the prompt of the criterion.

    Args:
        prompt (string, optional): If provided, set the prompt to this string.

    Returns:
        string

    **/
    prompt: function(prompt) {
        return OpenAssessment.Fields.stringField(this.promptSel, prompt);
    },

    /**
    Get the feedback value for the criterion.
    This is one of: "disabled", "optional", or "required".

    Returns:
        string

    **/
    feedback: function() {
        return $('.openassessment_criterion_feedback', this.element).val();
    },

    /**
    Add an option to the criterion.
    Uses the client-side template to create the new option.
    **/
    addOption: function() {
        this.optionContainer.add();
    },

    /**
     Hook into the event handler for addition of a criterion.

     */
    addHandler: function (){
        var criteria = $(".openassessment_criterion", this.element.parent());
        // Create the unique name for this option.
        var name = OpenAssessment.ItemUtilities.createUniqueName(criteria, "data-criterion");
        // Set the criterion name in the new rubric element.
        $(this.element).attr("data-criterion", name);
        $(".openassessment_criterion_name", this.element).attr("value", name);
    },

    /**
     Hook into the event handler for removal of a criterion.

     */
    removeHandler: function(){
        var criterionName = $(this.element).data('criterion');
        this.notifier.notificationFired("criterionRemove", {'criterionName': criterionName});
    },

    /**
     Hook into the event handler when a rubric criterion is modified.

     */
    updateHandler: function(){
        var fields = this.getFieldValues();
        var criterionName = fields.name;
        var criterionLabel = fields.label;
        this.notifier.notificationFired(
            "criterionUpdated",
            {'criterionName': criterionName, 'criterionLabel': criterionLabel}
        );
    },

    /**
    Mark validation errors.

    Returns:
        Boolean indicating whether the criterion is valid.

    **/
    validate: function() {
        // The criterion prompt is required.
        var isValid = (this.prompt() !== "");

        if (!isValid) {
            this.promptSel.addClass("openassessment_highlighted_field");
        }

        // All options must be valid
        $.each(this.optionContainer.getAllItems(), function() {
            isValid = (this.validate() && isValid);
        });
        return isValid;
    },

   /**
    Return a list of validation errors visible in the UI.
    Mainly useful for testing.

    Returns:
        list of string

    **/
    validationErrors: function() {
        var errors = [];

        // Criterion prompt errors
        if (this.promptSel.hasClass('openassessment_highlighted_field')) {
            errors.push("Criterion prompt is invalid.");
        }

        // Option errors
        $.each(this.optionContainer.getAllItems(), function() {
            errors = errors.concat(this.validationErrors());
        });

        return errors;
    },

    /**
    Clear all validation errors from the UI.
    **/
    clearValidationErrors: function() {
        // Clear criterion prompt errors
        this.promptSel.removeClass("openassessment_highlighted_field");

        // Clear option errors
        $.each(this.optionContainer.getAllItems(), function() {
            this.clearValidationErrors();
        });
    }
};


/**
 The TrainingExample class is used to construct and retrieve information from its element within the DOM

 Args:
     element (JQuery Object): the selection which identifies the scope of the training example.

 Returns:
     OpenAssessment.TrainingExample

 **/
OpenAssessment.TrainingExample = function(element){
    this.element = element;
    this.criteria = $(".openassessment_training_example_criterion_option", this.element);
    this.answer = $('.openassessment_training_example_essay', this.element).first();
};

OpenAssessment.TrainingExample.prototype = {
    /**
     Returns the values currently stored in the fields associated with this training example.
     **/
    getFieldValues: function () {

        // Iterates through all of the options selected by the training example, and adds them
        // to a list.
        var optionsSelected = this.criteria.map(
            function () {
                return {
                    criterion: $(this).data('criterion'),
                    option: $(this).prop('value')
                };
            }
        ).get();

        return {
            answer: this.answer.prop('value'),
            options_selected: optionsSelected
        };
    },

    addHandler: function() {
        // Goes through and instantiates the option description in the training example for each option.
        $(".openassessment_training_example_criterion_option", this.element) .each( function () {
            $('option', this).each(function(){
                OpenAssessment.ItemUtilities.refreshOptionString($(this));
            });
        });
    },
    addEventListeners: function() {},
    removeHandler: function() {},
    updateHandler: function() {},

    /**
    Mark validation errors.

    Returns:
        Boolean indicating whether the criterion is valid.

    **/
    validate: function() {
        var isValid = true;

        this.criteria.each(
            function() {
                var isOptionValid = ($(this).prop('value') !== "");
                isValid = isOptionValid && isValid;

                if (!isOptionValid) {
                    $(this).addClass("openassessment_highlighted_field");
                }
            }
        );

        return isValid;
    },

    /**
    Return a list of validation errors visible in the UI.
    Mainly useful for testing.

    Returns:
        list of string

    **/
    validationErrors: function() {
        var errors = [];
        this.criteria.each(
            function() {
                var hasError = $(this).hasClass("openassessment_highlighted_field");
                if (hasError) {
                    errors.push("Student training example is invalid.");
                }
            }
        );
        return errors;
    },

    /**
    Retrieve all elements representing items in this container.

    Returns:
        array of container item objects

    **/
    clearValidationErrors: function() {
        this.criteria.each(
            function() { $(this).removeClass("openassessment_highlighted_field"); }
        );
    }
};

/**
 The AIExample class is used to construct and retrieve information from its element within the DOM
 Note the similarity of the AI Example class and the TrainingExample Class.

 Args:
 element (JQuery Object): the selection which identifies the scope of the AI training example.

 Returns:
 OpenAssessment.AIExample

 **/
OpenAssessment.AIExample = function(element){
    // Hides the element on load
    this.element = $(element).addClass('is--hidden');
    this.labelSel = $('.openassessment_ai_example_label_field', this.element).find('input').first();
    this.answer = $('.openassessment_ai_example_essay', this.element).first();
    this.criteria = $(".openassessment_ai_example_criterion_option", this.element);
};

OpenAssessment.AIExample.prototype = {

    /**
     Returns the values currently stored in the fields associated with this training example.
     **/
    getFieldValues: function () {

        // Iterates through all of the options selected by the training example, and adds them
        // to a list.
        var optionsSelected = this.criteria.map(
            function () {
                return {
                    criterion: $(this).data('criterion'),
                    option: $(this).prop('value')
                };
            }
        ).get();

        // Adds the label and answer to the dictionary definition of the AI example
        return {
            answer: this.answer.prop('value'),
            label: this.labelSel.prop('value'),
            options_selected: optionsSelected
        };
    },

    addHandler: function() {
        // Goes through and refreshes the option description in the training example for each option.
        $(".openassessment_ai_example_criterion_option", this.element) .each( function () {
            $('option', this).each(function(){
                OpenAssessment.ItemUtilities.refreshOptionString($(this));
            });
        });

        // Constructs a unique name for the example so that it can be paired with a AIMenuItem
        $(this.element).attr(
            'data-example', OpenAssessment.ItemUtilities.createUniqueName(this.element, 'data-example')
        );

        this.addEventListeners();
    },

    addEventListeners: function() {
        // Install a focus out handler to propagate label changes to their corresponding menu items.
        $(this.labelSel).focusout($.proxy(this.updateHandler, this));
    },

    updateHandler: function() {
        var view = this;
        // On an update of the label field, we need to find the corresponding menu item and change
        // it's text to be the new value for the label field.
        var sel = ".openassessment_ai_example_menu_item[data-example='"+ $(this.element).attr('data-example') +"']"
        $(sel, $(this.element).closest('#openassessment_ai_editor_menu_and_editor'))
            .find('h2')
            .first()
            .text($(view.labelSel).val());
    },

    /**
     Mark validation errors.

     Returns:
     Boolean indicating whether the criterion is valid.

     **/
    validate: function() {
        var isValid = true;

        this.criteria.each(
            function() {
                var isOptionValid = ($(this).prop('value') !== "");
                isValid = isOptionValid && isValid;

                if (!isOptionValid) {
                    $(this).addClass("openassessment_highlighted_field");
                }
            }
        );

        return isValid;
    },

    /**
     Return a list of validation errors visible in the UI.
     Mainly useful for testing.

     Returns:
     list of string

     **/
    validationErrors: function() {
        var errors = [];
        this.criteria.each(
            function() {
                var hasError = $(this).hasClass("openassessment_highlighted_field");
                if (hasError) {
                    errors.push("An Example Based Assessment Example is invalid.");
                }
            }
        );
        return errors;
    },

    /**
     Retrieve all elements representing items in this container.

     Returns:
     array of container item objects

     **/
    clearValidationErrors: function() {
        this.criteria.each(
            function() { $(this).removeClass("openassessment_highlighted_field"); }
        );
    },

    removeHandler: function() {}

};

/**
 The AIExampleMenuItem class is used as a partner to the AIExample class, with the idea being a 1:1 relationship
 maintains a menu which can be used to navigate through examples, displaying one at a time.

 Args:
 element (JQuery Object): the selection which identifies the scope of the AI Menu Item.

 Returns:
 OpenAssessment.AIExampleMenuItem

 **/
OpenAssessment.AIExampleMenuItem = function(element){
    this.element = element;
    this.labelSel = $('.openassessment_ai_example_label_field', this.element);
    // The first element up the DOM tree which contains both the editing panels and the menu items.
    this.menuAndEditor = $(this.element).closest('#openassessment_ai_editor_menu_and_editor');
};

OpenAssessment.AIExampleMenuItem.prototype = {

    /**
     Adds a click handler to the item that will display its corresponding panel, while highlighting
     itself and removing higlighting from all other menu items.
    **/
    addEventListeners: function() {
        var exampleName = $(this.element).attr('data-example');
        var view = this;
        $(this.element).click(function() {
            // Hides all of the examples, then displays the one which has the same data-example value as the menu item.
            OpenAssessment.ItemUtilities.addClassToAllButOne(
                view.menuAndEditor,
                '.openassessment_ai_editor_single_visibility',
                '.openassessment_ai_example[data-example="' + exampleName + '"]',
                'is--hidden'
            );
            // Adds a "faded" look to all of the menu items, and then bolds the one which has the same data-example value.
            OpenAssessment.ItemUtilities.addClassToAllButOne(
                view.menuAndEditor,
                '.openassessment_ai_menu_single_visibility',
                '.openassessment_ai_example_menu_item[data-example="' + exampleName + '"]',
                'is--faded'
            );
        });
    },

    /**
     Finds the example that the MenuItem corresponds to, and removes it from the DOM after doing some checks
     to examine what element should next be displayed.
     */
    removeHandler: function() {
        // Finds the paired example
        var pairedExample = $('.openassessment_ai_example[data-example="'+ $(this.element).attr('data-example') +'"]', this.menuAndEditor);
        // Boolean indicating whether or not the paired example is the last example in the list
        var lastExample = $('.openassessment_ai_example', $(pairedExample).parent()).length == 1;
        // Boolean indicating whether or not the paired example is currently selected
        var currentlySelected = ! $(pairedExample).hasClass('is--hidden');
        // If either of the above are true, when we delete from the MenuItem, we want the "empty" screen to show up.
        if (lastExample || currentlySelected){
            $('#openassessment_ai_example_editor_background', $(pairedExample).parent()).removeClass('is--hidden');
        }
        $(pairedExample).remove();
    },

    /**
     On add, we create a unique name for the exampleMenuItem, and because we only instantiate AIExampleMenuItems
     at the same time as we instantiate AIExamples, these numbers always match, because they share the same generation
     code.  Note that this is certainly a weak point of this solution, and should be changed if adequate time is
     provided.
     */
    addHandler: function() {
        $(this.element).attr(
            'data-example', OpenAssessment.ItemUtilities.createUniqueName(this.element, 'data-example')
        );
        this.addEventListeners();
    },
    getFieldValues: function () {},
    updateHandler: function() {},
    validate: function() { return true; },
    validationErrors: function() { return []; },
    clearValidationErrors: function() {}
};