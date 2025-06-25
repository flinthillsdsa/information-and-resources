---
layout: page
title: "Contact Us"
background: grey
---

<div class="col-lg-12 text-center">
	<h2 class="section-heading text-uppercase">Contact Us</h2>
	<h3 class="section-subheading text-muted">Get in touch with Flint Hills DSA</h3>
</div>

<div class="row justify-content-center">
  <div class="col-lg-8">
    <!-- Debug: This should show if the page is loading -->
    <p><strong>Debug:</strong> If you can see this text, the page layout is working.</p>
    
    <!-- Test if basic HTML works -->
    <div style="border: 2px solid red; padding: 10px; margin: 10px 0;">
      <p>This is a test div. If you see this, basic HTML is rendering.</p>
    </div>

    <style>
    /* Force Action Network forms into single column layout */
    #can_embed_form.can_float.can_768 {
      display: block !important;
    }

    /* Override the two-column layout */
    #form_col1, #form_col2 {
      float: none !important;
      width: 100% !important;
      clear: both !important;
      margin-right: 0 !important;
      margin-left: 0 !important;
      display: block !important;
    }

    /* Stack form fields on top */
    #form_col1 {
      margin-bottom: 30px !important;
    }

    /* Submit section goes below */
    #form_col2 {
      margin-top: 20px !important;
      padding-top: 20px !important;
      border-top: 1px solid #e0e0e0;
    }

    /* Make submit button full width */
    #form_col2 input[type="submit"] {
      width: 100% !important;
      max-width: none !important;
      display: block !important;
      margin: 0 auto !important;
      padding: 15px 20px !important;
      font-size: 16px !important;
    }

    /* Clear any floats */
    .clear {
      clear: both !important;
    }
    </style>

    <!-- Debug: Check if this text appears -->
    <p><strong>Debug:</strong> About to load Action Network form...</p>
    
    <link href='https://actionnetwork.org/css/style-embed-whitelabel-v3.css' rel='stylesheet' type='text/css' />
    <script src='https://actionnetwork.org/widgets/v5/form/contact-us-173?format=js&source=widget'></script>
    <div id='can-form-area-contact-us-173' style='width: 100%; border: 1px dashed blue; min-height: 200px; padding: 20px;'>
      <!-- this div is the target for our HTML insertion -->
      <p><strong>Debug:</strong> This text should be replaced by the Action Network form. If you still see this, the JavaScript didn't load or execute.</p>
    </div>
    
    <!-- Debug: Check if this text appears -->
    <p><strong>Debug:</strong> Form should have loaded above this text.</p>
  </div>
</div>

<script>
// Debug script to check if Action Network loaded
setTimeout(function() {
  var formArea = document.getElementById('can-form-area-contact-us-173');
  if (formArea && formArea.innerHTML.includes('Debug:')) {
    console.log('Action Network form did not load - still showing debug text');
    formArea.innerHTML += '<p style="color: red; font-weight: bold;">ERROR: Action Network form failed to load!</p>';
  } else {
    console.log('Action Network form appears to have loaded successfully');
  }
}, 3000); // Wait 3 seconds for form to load
</script>
