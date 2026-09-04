/* ==========================================================================
   KENNY JOHNSON UNIVERSITY (KJU) — META ADS CAMPAIGN CONTROLLER
   ========================================================================== */

(function () {
  'use strict';

  // Configuration
  const CONFIG = {
    requiredWatchThreshold: 0.85, // 85% of video to unlock
    calendlyBaseUrl: 'https://calendly.com/d/cp2f-sj7-4vx',
    paidConsultationUrl: 'https://calendly.com/d/cp2f-sj7-4vx?type=paid',
    resourcePdfPath: 'File/The 5-Minute Credit Report Check.pdf',
    resourcePdfName: 'The 5-Minute Credit Report Check.pdf'
  };

  // State
  const state = {
    // Video & Resource Gate
    videoStarted: false,
    videoProgress: 0,
    maxWatchTime: 0,
    resourceUnlocked: false,
    resourceDownloaded: false,

    // Attribution
    attribution: {},

    // Qualification Engine
    currentStepIndex: 0,
    activeStepSequence: [],
    answers: {
      province: 'QC',
      showingItems: [],
      negativeCount: '',
      hasCollections: '',
      collectionsCount: '',
      hasProposal: '',
      proposalDischarged: '',
      hasBankruptcy: '',
      bankruptcyDischarged: '',
      hasBureauAccess: ''
    },
    qualificationStatus: 'IN_PROGRESS', // 'IN_PROGRESS' | 'QUALIFIED' | 'NOT_CURRENTLY_ELIGIBLE'
    disqualificationReason: '',

    // Contact Details
    contact: {
      fullName: '',
      email: '',
      phone: '',
      consent: true
    }
  };

  // --------------------------------------------------------------------------
  // 1. ANALYTICS & ATTRIBUTION TRACKER
  // --------------------------------------------------------------------------
  function initAttribution() {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      state.attribution = {
        utm_source: urlParams.get('utm_source') || 'meta_ads',
        utm_medium: urlParams.get('utm_medium') || 'cpc',
        utm_campaign: urlParams.get('utm_campaign') || 'credit_education',
        utm_content: urlParams.get('utm_content') || '',
        utm_term: urlParams.get('utm_term') || '',
        fbclid: urlParams.get('fbclid') || '',
        referrer: document.referrer || '',
        landing_page: window.location.href
      };
    } catch (e) {}
  }

  function trackEvent(eventName, payload = {}) {
    try {
      const eventData = {
        event: eventName,
        timestamp: new Date().toISOString(),
        ...state.attribution,
        ...payload
      };
      console.log(`[KJU Analytics] ${eventName}:`, eventData);

      // Meta Pixel
      if (typeof window.fbq === 'function') {
        if (eventName === 'qualified_lead') {
          window.fbq('track', 'Lead', payload);
        } else if (eventName === 'free_call_booked') {
          window.fbq('track', 'Schedule', payload);
        } else {
          window.fbq('trackCustom', eventName, payload);
        }
      }

      // Google Tag Manager
      if (window.dataLayer && Array.isArray(window.dataLayer)) {
        window.dataLayer.push(eventData);
      }

      // Custom window event
      window.dispatchEvent(new CustomEvent('kju_analytics_event', { detail: eventData }));
    } catch (e) {}
  }

  // --------------------------------------------------------------------------
  // 2. VIDEO GATE & UNLOCK CONTROLLER
  // --------------------------------------------------------------------------
  function initVideoGate() {
    const video = document.getElementById('kjuKennyVideo');
    const unmuteBtn = document.getElementById('kjuUnmuteBtn');
    const progressText = document.getElementById('kjuVideoProgressText');
    const resourceCard = document.getElementById('kjuResourceGateCard');
    const downloadBtn = document.getElementById('kjuDownloadResourceBtn');
    const postPrompt = document.getElementById('kjuResourcePostPrompt');
    const transcriptToggle = document.getElementById('kjuTranscriptToggle');
    const transcriptContent = document.getElementById('kjuTranscriptContent');

    const dossierBox = document.getElementById('kjuDossierBox');
    const unmuteText = document.getElementById('kjuUnmuteText');
    const dockedStamp = document.getElementById('kjuPlayerDockedStamp');
    const stampIcon = document.getElementById('kjuStampIcon');
    const stampLabel = document.getElementById('kjuStampLabel');

    // Check session storage for returning unlocked users
    try {
      if (sessionStorage.getItem('kju_resource_unlocked') === 'true') {
        unlockResource();
      }
    } catch (e) {}

    // Direct autoplay execution on page open (muted satisfies browser security policies)
    if (video) {
      video.muted = true;
      const attemptAutoplay = () => {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            state.videoStarted = true;
          }).catch(() => {
            // If browser autoplay policy requires user interaction, start on first interaction
            const unlockPlay = () => {
              video.play();
              document.removeEventListener('click', unlockPlay);
              document.removeEventListener('touchstart', unlockPlay);
            };
            document.addEventListener('click', unlockPlay, { once: true });
            document.addEventListener('touchstart', unlockPlay, { once: true });
          });
        }
      };

      if (video.readyState >= 2) {
        attemptAutoplay();
      } else {
        video.addEventListener('loadedmetadata', attemptAutoplay, { once: true });
        // Fallback timer
        setTimeout(attemptAutoplay, 250);
      }
    }

    if (transcriptToggle) {
      transcriptToggle.addEventListener('click', () => {
        const isOpen = dossierBox ? dossierBox.classList.toggle('is-open') : false;
        transcriptToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        if (transcriptContent) {
          transcriptContent.classList.toggle('is-open', isOpen);
        }
        const folderIcon = transcriptToggle.querySelector('.kju-dossier-icon-wrap i');
        if (folderIcon) {
          folderIcon.className = isOpen ? 'fa-solid fa-folder-open' : 'fa-solid fa-folder-closed';
        }
      });
    }

    if (unmuteBtn && video) {
      unmuteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        video.muted = false;
        video.volume = 1.0;
        if (unmuteText) {
          unmuteText.textContent = 'AUDIO ACTIVE';
        }
        unmuteBtn.classList.add('is-active');
        if (video.paused) video.play();
        setTimeout(() => {
          unmuteBtn.style.opacity = '0.5';
        }, 2200);
      });

      unmuteBtn.addEventListener('mouseenter', () => {
        unmuteBtn.style.opacity = '1';
      });

      unmuteBtn.addEventListener('mouseleave', () => {
        if (!video.muted) unmuteBtn.style.opacity = '0.5';
      });
    }

    if (video) {
      video.addEventListener('click', () => {
        if (video.muted && unmuteBtn) {
          unmuteBtn.click();
        } else {
          if (video.paused) video.play();
          else video.pause();
        }
      });
    }

    if (video) {
      video.addEventListener('play', () => {
        if (!state.videoStarted) {
          state.videoStarted = true;
          trackEvent('video_started', { video: 'Kenny Educational Video' });
        }
      });

      video.addEventListener('timeupdate', () => {
        if (!video.duration) return;

        // Anti-scrubbing progress tracking
        if (video.currentTime > state.maxWatchTime + 2 && !state.resourceUnlocked) {
          video.currentTime = state.maxWatchTime;
        } else if (video.currentTime > state.maxWatchTime) {
          state.maxWatchTime = video.currentTime;
        }

        const pct = Math.min(100, Math.round((video.currentTime / video.duration) * 100));
        state.videoProgress = pct;

        if (progressText && !state.resourceUnlocked) {
          progressText.textContent = `Watch Progress: ${pct}%`;
        }

        // Check threshold unlock
        if (!state.resourceUnlocked && (video.currentTime / video.duration >= CONFIG.requiredWatchThreshold)) {
          unlockResource();
        }
      });

      video.addEventListener('ended', () => {
        if (!state.resourceUnlocked) {
          unlockResource();
        }
        trackEvent('video_completed');
      });
    }

    function unlockResource() {
      state.resourceUnlocked = true;
      try {
        sessionStorage.setItem('kju_resource_unlocked', 'true');
      } catch (e) {}

      trackEvent('resource_unlocked');

      if (dockedStamp) {
        dockedStamp.classList.add('is-unlocked');
      }
      if (stampIcon) {
        stampIcon.className = 'fa-solid fa-unlock';
      }
      if (stampLabel) {
        stampLabel.textContent = 'UNLOCKED (FREE)';
      }

      if (resourceCard) {
        resourceCard.classList.add('is-unlocked');
        const lockPill = resourceCard.querySelector('.kju-lock-status-pill');
        if (lockPill) {
          lockPill.innerHTML = '<i class="fa-solid fa-circle-check" style="color: var(--kju-gold);"></i> RESOURCE UNLOCKED';
        }
      }

      if (progressText) {
        progressText.innerHTML = '<span style="color: var(--kju-gold);">✓ Video Watched · Resource Unlocked</span>';
      }

      if (downloadBtn) {
        downloadBtn.disabled = false;
        downloadBtn.classList.remove('disabled', 'kju-btn-secondary');
        downloadBtn.classList.add('kju-btn-primary');
        downloadBtn.innerHTML = '<span>DOWNLOAD FREE RESOURCE</span> <i class="fa-solid fa-download"></i>';
      }
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!state.resourceUnlocked) return;

        state.resourceDownloaded = true;
        trackEvent('resource_downloaded', { resource: CONFIG.resourcePdfName });

        // Trigger file download
        const a = document.createElement('a');
        a.href = CONFIG.resourcePdfPath;
        a.download = CONFIG.resourcePdfName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Reveal consultation check prompt
        if (postPrompt) {
          postPrompt.classList.add('is-visible');
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // 3. MULTI-STEP QUALIFICATION ENGINE (STATE MACHINE)
  // --------------------------------------------------------------------------
  const modalOverlay = document.getElementById('kjuQualModal');
  const modalCloseBtn = document.getElementById('kjuModalClose');
  const progressText = document.getElementById('kjuQualProgressText');
  const progressFill = document.getElementById('kjuQualProgressFill');
  const backBtn = document.getElementById('kjuQualBackBtn');
  const nextBtn = document.getElementById('kjuQualNextBtn');

  // Step IDs definitions
  const ALL_STEPS = [
    'step_province',     // Q1
    'step_items',        // Q2 (multi-select)
    'step_item_count',   // Q3
    'step_collections',  // Q4
    'step_coll_count',   // Q5 (conditional)
    'step_proposal',     // Q6
    'step_prop_disch',   // Q7 (conditional)
    'step_bankruptcy',   // Q8
    'step_bank_disch',   // Q9 (conditional)
    'step_bureaus',      // Q10
    'step_contact',      // Contact capture
    'step_calendly'      // Calendly embed
  ];

  function calculateStepSequence() {
    const seq = ['step_province', 'step_items', 'step_item_count', 'step_collections'];

    // Q5 Conditional
    if (state.answers.hasCollections === 'Yes') {
      seq.push('step_coll_count');
    }

    seq.push('step_proposal');

    // Q7 Conditional
    if (state.answers.hasProposal === 'Yes') {
      seq.push('step_prop_disch');
    }

    seq.push('step_bankruptcy');

    // Q9 Conditional
    if (state.answers.hasBankruptcy === 'Yes') {
      seq.push('step_bank_disch');
    }

    seq.push('step_bureaus');
    seq.push('step_contact');
    seq.push('step_calendly');

    return seq;
  }

  function openFitCheck() {
    if (!modalOverlay) return;
    modalOverlay.classList.add('is-active');
    document.body.style.overflow = 'hidden';

    trackEvent('qualification_cta_clicked');

    if (state.qualificationStatus === 'IN_PROGRESS' && state.currentStepIndex === 0) {
      trackEvent('form_started');
      renderCurrentStep();
    }
  }

  function closeFitCheck() {
    if (!modalOverlay) return;
    modalOverlay.classList.remove('is-active');
    document.body.style.overflow = '';
    const modalCard = document.querySelector('.kju-modal-card');
    if (modalCard) modalCard.classList.remove('is-calendly-active');
  }

  function renderCurrentStep() {
    state.activeStepSequence = calculateStepSequence();
    const currentStepId = state.activeStepSequence[state.currentStepIndex];

    const modalCard = document.querySelector('.kju-modal-card');
    if (modalCard) {
      if (currentStepId === 'step_calendly') {
        modalCard.classList.add('is-calendly-active');
      } else {
        modalCard.classList.remove('is-calendly-active');
      }
    }

    // Hide all steps and result screen
    document.querySelectorAll('.kju-step-container').forEach(el => el.classList.remove('is-active'));
    const resultBox = document.getElementById('step_result');
    if (resultBox) resultBox.classList.remove('is-active');

    // If disqualified
    if (state.qualificationStatus === 'NOT_CURRENTLY_ELIGIBLE') {
      showDisqualificationScreen();
      return;
    }

    // Show active step
    const activeEl = document.getElementById(currentStepId);
    if (activeEl) {
      activeEl.classList.add('is-active');
    }

    // Update Progress Indicator
    const totalQuestions = state.activeStepSequence.length - 2; // Exclude contact & calendly
    const currentQNumber = Math.min(totalQuestions, state.currentStepIndex + 1);

    if (currentStepId === 'step_contact') {
      if (progressText) progressText.textContent = 'FINAL STEP: YOUR DETAILS';
      if (progressFill) progressFill.style.width = '95%';
    } else if (currentStepId === 'step_calendly') {
      if (progressText) progressText.textContent = 'SCHEDULE YOUR STRATEGY CALL';
      if (progressFill) progressFill.style.width = '100%';
    } else {
      if (progressText) progressText.textContent = `QUESTION ${currentQNumber} OF ${totalQuestions}`;
      const pct = Math.round((currentQNumber / totalQuestions) * 100);
      if (progressFill) progressFill.style.width = `${pct}%`;
    }

    // Update Navigation Buttons
    if (backBtn) {
      backBtn.style.display = state.currentStepIndex > 0 && currentStepId !== 'step_calendly' ? 'inline-flex' : 'none';
    }

    if (nextBtn) {
      if (currentStepId === 'step_contact') {
        nextBtn.style.display = 'inline-flex';
        nextBtn.innerHTML = '<span>Continue to Book Your Free Call</span> <i class="fa-solid fa-arrow-right"></i>';
      } else if (currentStepId === 'step_calendly') {
        nextBtn.style.display = 'none';
      } else {
        nextBtn.style.display = 'inline-flex';
        nextBtn.innerHTML = '<span>Continue</span> <i class="fa-solid fa-arrow-right"></i>';
      }
    }
  }

  function handleNext() {
    state.activeStepSequence = calculateStepSequence();
    const currentStepId = state.activeStepSequence[state.currentStepIndex];

    // Validation per step
    if (currentStepId === 'step_province') {
      const select = document.getElementById('kjuProvinceSelect');
      state.answers.province = select ? select.value : 'QC';
      trackEvent('question_answered', { question: 'province', answer: state.answers.province });
    } else if (currentStepId === 'step_items') {
      if (state.answers.showingItems.length === 0) {
        alert('Please select at least one option to continue.');
        return;
      }
      trackEvent('question_answered', { question: 'showing_items', answer: state.answers.showingItems });
      // Disqualification Check: None of the above
      if (state.answers.showingItems.includes('None of the above')) {
        disqualify('none_of_above');
        return;
      }
    } else if (currentStepId === 'step_item_count') {
      if (!state.answers.negativeCount) {
        alert('Please select an option to continue.');
        return;
      }
      trackEvent('question_answered', { question: 'negative_count', answer: state.answers.negativeCount });
    } else if (currentStepId === 'step_collections') {
      if (!state.answers.hasCollections) {
        alert('Please select Yes, No, or Not sure.');
        return;
      }
      trackEvent('question_answered', { question: 'has_collections', answer: state.answers.hasCollections });
    } else if (currentStepId === 'step_coll_count') {
      if (!state.answers.collectionsCount) {
        alert('Please select how many collection accounts.');
        return;
      }
      trackEvent('question_answered', { question: 'collections_count', answer: state.answers.collectionsCount });
    } else if (currentStepId === 'step_proposal') {
      if (!state.answers.hasProposal) {
        alert('Please select Yes or No.');
        return;
      }
      trackEvent('question_answered', { question: 'has_proposal', answer: state.answers.hasProposal });
    } else if (currentStepId === 'step_prop_disch') {
      if (!state.answers.proposalDischarged) {
        alert('Please select Yes or No.');
        return;
      }
      trackEvent('question_answered', { question: 'proposal_discharged', answer: state.answers.proposalDischarged });
      // Disqualification check: Not discharged proposal
      if (state.answers.proposalDischarged === 'No') {
        disqualify('active_proposal');
        return;
      }
    } else if (currentStepId === 'step_bankruptcy') {
      if (!state.answers.hasBankruptcy) {
        alert('Please select Yes or No.');
        return;
      }
      trackEvent('question_answered', { question: 'has_bankruptcy', answer: state.answers.hasBankruptcy });
    } else if (currentStepId === 'step_bank_disch') {
      if (!state.answers.bankruptcyDischarged) {
        alert('Please select Yes or No.');
        return;
      }
      trackEvent('question_answered', { question: 'bankruptcy_discharged', answer: state.answers.bankruptcyDischarged });
      // Disqualification check: Not discharged bankruptcy
      if (state.answers.bankruptcyDischarged === 'No') {
        disqualify('active_bankruptcy');
        return;
      }
    } else if (currentStepId === 'step_bureaus') {
      if (!state.answers.hasBureauAccess) {
        alert('Please select Yes or No.');
        return;
      }
      trackEvent('question_answered', { question: 'has_bureau_access', answer: state.answers.hasBureauAccess });
      // Disqualification check: No access to both Credit Karma and Equifax
      if (state.answers.hasBureauAccess === 'No') {
        disqualify('no_bureau_access');
        return;
      }
    } else if (currentStepId === 'step_contact') {
      const nameInput = document.getElementById('kjuContactName');
      const emailInput = document.getElementById('kjuContactEmail');
      const phoneInput = document.getElementById('kjuContactPhone');

      const name = nameInput ? nameInput.value.trim() : '';
      const email = emailInput ? emailInput.value.trim() : '';
      const phone = phoneInput ? phoneInput.value.trim() : '';

      if (!name || name.length < 2) {
        if (nameInput) nameInput.classList.add('is-invalid');
        alert('Please enter your full name.');
        return;
      }
      if (nameInput) nameInput.classList.remove('is-invalid');

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (emailInput) emailInput.classList.add('is-invalid');
        alert('Please enter a valid email address.');
        return;
      }
      if (emailInput) emailInput.classList.remove('is-invalid');

      if (!phone || phone.replace(/\D/g, '').length < 10) {
        if (phoneInput) phoneInput.classList.add('is-invalid');
        alert('Please enter a valid 10-digit phone number.');
        return;
      }
      if (phoneInput) phoneInput.classList.remove('is-invalid');

      state.contact.fullName = name;
      state.contact.email = email;
      state.contact.phone = phone;

      // LEAD SAVE & PERSISTENCE
      saveLeadRecord();
      state.qualificationStatus = 'QUALIFIED';
      trackEvent('qualified_lead', {
        name: name,
        email: email,
        phone: phone,
        province: state.answers.province
      });

      // Advance to Calendly
      state.currentStepIndex++;
      renderCurrentStep();
      loadCalendlyEmbed();
      return;
    }

    // Step forward
    if (state.currentStepIndex < state.activeStepSequence.length - 1) {
      state.currentStepIndex++;
      renderCurrentStep();
    }
  }

  function handleBack() {
    // If returning from Calendly when in disqualified / paid state
    const calStep = document.getElementById('step_calendly');
    if (calStep && calStep.classList.contains('is-active') && state.qualificationStatus === 'NOT_CURRENTLY_ELIGIBLE') {
      showDisqualificationScreen();
      return;
    }

    if (state.qualificationStatus === 'NOT_CURRENTLY_ELIGIBLE') {
      state.qualificationStatus = 'IN_PROGRESS';
      renderCurrentStep();
      return;
    }

    if (state.currentStepIndex > 0) {
      state.currentStepIndex--;
      renderCurrentStep();
    }
  }

  function disqualify(reasonKey) {
    state.qualificationStatus = 'NOT_CURRENTLY_ELIGIBLE';
    state.disqualificationReason = reasonKey;
    trackEvent('not_currently_eligible', { reason: reasonKey });
    showDisqualificationScreen();
  }

  function showDisqualificationScreen() {
    const modalCard = document.querySelector('.kju-modal-card');
    if (modalCard) modalCard.classList.remove('is-calendly-active');

    document.querySelectorAll('.kju-step-container').forEach(el => el.classList.remove('is-active'));
    const resultBox = document.getElementById('step_result');
    if (!resultBox) return;

    resultBox.classList.add('is-active');

    if (progressText) progressText.textContent = 'CONSULTATION ELIGIBILITY STATUS';
    if (progressFill) progressFill.style.width = '100%';
    if (backBtn) backBtn.style.display = 'inline-flex';
    if (nextBtn) nextBtn.style.display = 'none';

    const explText = document.getElementById('kjuResultExplanation');
    const paidBtn = document.getElementById('kjuPaidConsultBtn');

    if (explText) {
      if (state.disqualificationReason === 'none_of_above') {
        explText.innerHTML = '<strong>You\'re not currently eligible for KJU\'s free consultation.</strong><br><br>Our free consultation is reserved for people dealing with one or more of the credit issues listed above.<br><br>If you\'d still like to speak directly with Kenny about your credit situation, you can book a paid consultation with him.';
      } else if (state.disqualificationReason === 'active_proposal') {
        explText.innerHTML = '<strong>You\'re not currently eligible for KJU\'s free consultation.</strong><br><br>Our free consultation requires consumer proposals to be fully discharged before an individual strategy review can assess tradelines.<br><br>If you\'d still like to speak directly with Kenny about your credit situation, you can book a paid consultation with him.';
      } else if (state.disqualificationReason === 'active_bankruptcy') {
        explText.innerHTML = '<strong>You\'re not currently eligible for KJU\'s free consultation.</strong><br><br>Our free consultation requires bankruptcies to be formally discharged before an individual strategy review can assess tradelines.<br><br>If you\'d still like to speak directly with Kenny about your credit situation, you can book a paid consultation with him.';
      } else if (state.disqualificationReason === 'no_bureau_access') {
        explText.innerHTML = '<strong>You\'re not currently eligible for KJU\'s free consultation.</strong><br><br>To properly review your situation during a free consultation, you\'ll need access to both Credit Karma and Equifax.<br><br>You can come back and complete the questionnaire once you have access to both.<br><br>If you\'d prefer to speak directly with Kenny about your situation now, you also have the option to book a paid consultation.';
      } else {
        explText.innerHTML = '<strong>You\'re not currently eligible for KJU\'s free consultation.</strong><br><br>Our free consultation scope is structured around specific verified reporting situations.';
      }
    }

    if (paidBtn) {
      paidBtn.onclick = (e) => {
        e.preventDefault();
        trackEvent('paid_call_clicked', { reason: state.disqualificationReason });
        // Embed Paid Calendly directly inside the modal card!
        document.querySelectorAll('.kju-step-container').forEach(el => el.classList.remove('is-active'));
        const calStep = document.getElementById('step_calendly');
        if (calStep) calStep.classList.add('is-active');
        loadCalendlyEmbed(
          CONFIG.paidConsultationUrl,
          'Schedule Paid Consultation With Kenny',
          'Select an available time slot below to speak directly with Kenny about your credit situation.'
        );
        if (progressText) progressText.textContent = 'PAID CONSULTATION SCHEDULING';
        if (progressFill) progressFill.style.width = '100%';
        if (backBtn) backBtn.style.display = 'inline-flex';
        if (nextBtn) nextBtn.style.display = 'none';
      };
    }
  }

  function saveLeadRecord() {
    try {
      const leadData = {
        fullName: state.contact.fullName,
        email: state.contact.email,
        phone: state.contact.phone,
        province: state.answers.province,
        answers: state.answers,
        qualificationStatus: state.qualificationStatus,
        attribution: state.attribution,
        submittedAt: new Date().toISOString()
      };
      localStorage.setItem('kju_saved_lead', JSON.stringify(leadData));
      trackEvent('contact_submitted', { email: state.contact.email });
    } catch (e) {}
  }

  function loadCalendlyEmbed(customUrl, titleText, subtitleText) {
    const container = document.getElementById('kjuCalendlyContainer');
    if (!container) return;

    trackEvent('calendly_viewed');

    const modalCard = document.querySelector('.kju-modal-card');
    if (modalCard) {
      modalCard.classList.add('is-calendly-active');
    }

    const titleEl = document.getElementById('kjuCalendlyTitle');
    const subEl = document.getElementById('kjuCalendlySubtitle');
    if (titleEl) {
      titleEl.textContent = titleText || 'Choose Your Free Consultation Time';
    }
    if (subEl) {
      subEl.textContent = subtitleText || 'Select an available time slot below to complete your booking.';
    }

    const nameParam = encodeURIComponent(state.contact.fullName || '');
    const emailParam = encodeURIComponent(state.contact.email || '');
    const phoneParam = encodeURIComponent(state.contact.phone || '');

    const baseUrl = customUrl || CONFIG.calendlyBaseUrl;
    const separator = baseUrl.includes('?') ? '&' : '?';
    const params = [];
    if (state.contact.fullName) params.push(`name=${nameParam}`);
    if (state.contact.email) params.push(`email=${emailParam}`);
    if (state.contact.phone) params.push(`a1=${phoneParam}`);
    params.push('hide_gdpr_banner=1');
    params.push('primary_color=b8860b');

    const fullCalendlyUrl = `${baseUrl}${separator}${params.join('&')}`;

    container.innerHTML = `
      <iframe
        src="${fullCalendlyUrl}"
        width="100%"
        height="700"
        frameborder="0"
        title="KJU Consultation Booking"
        style="border-radius: 8px; background: #FFFFFF; width: 100%; min-height: 700px; border: none;"
      ></iframe>
    `;

    // Listen for Calendly booking postMessage
    window.addEventListener('message', (e) => {
      if (e.data && e.data.event && e.data.event === 'calendly.event_scheduled') {
        trackEvent('call_booked', { email: state.contact.email, isPaid: !!customUrl });
      }
    });
  }

  // --------------------------------------------------------------------------
  // 4. OPTION BUTTON SELECTION HANDLERS
  // --------------------------------------------------------------------------
  function initOptionListeners() {
    // Single select option buttons
    document.querySelectorAll('[data-single-select]').forEach(group => {
      const fieldName = group.dataset.singleSelect;
      const buttons = group.querySelectorAll('.kju-option-btn');

      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          buttons.forEach(b => b.classList.remove('is-selected'));
          btn.classList.add('is-selected');
          state.answers[fieldName] = btn.dataset.value;
        });
      });
    });

    // Multi-select for Question 2 (Showing Items)
    const q2Group = document.getElementById('kjuQ2OptionsGroup');
    if (q2Group) {
      const q2Buttons = q2Group.querySelectorAll('.kju-option-btn');
      q2Buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.dataset.value;

          if (val === 'None of the above') {
            // Deselect all others
            q2Buttons.forEach(b => b.classList.remove('is-selected'));
            btn.classList.add('is-selected');
            state.answers.showingItems = ['None of the above'];
          } else {
            // Remove 'None of the above'
            const noneBtn = q2Group.querySelector('[data-value="None of the above"]');
            if (noneBtn) noneBtn.classList.remove('is-selected');
            state.answers.showingItems = state.answers.showingItems.filter(i => i !== 'None of the above');

            const isSelected = btn.classList.toggle('is-selected');
            if (isSelected) {
              state.answers.showingItems.push(val);
            } else {
              state.answers.showingItems = state.answers.showingItems.filter(i => i !== val);
            }
          }
        });
      });
    }

    if (nextBtn) nextBtn.addEventListener('click', handleNext);
    if (backBtn) backBtn.addEventListener('click', handleBack);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeFitCheck);

    if (modalOverlay) {
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeFitCheck();
      });
    }

    // Trigger buttons on landing page
    document.querySelectorAll('[data-open-fit-check]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openFitCheck();
      });
    });

    // Exit result button
    const exitBtn = document.getElementById('kjuExitResultBtn');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        closeFitCheck();
      });
    }
  }

  // --------------------------------------------------------------------------
  // 5. FAQ ACCORDION
  // --------------------------------------------------------------------------
  function initFaqAccordion() {
    document.querySelectorAll('.kju-faq-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.closest('.kju-faq-item');
        const isOpen = item.classList.contains('is-open');

        document.querySelectorAll('.kju-faq-item').forEach(i => i.classList.remove('is-open'));

        if (!isOpen) {
          item.classList.add('is-open');
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // 6. SECONDARY CTA SMOOTH SCROLL
  // --------------------------------------------------------------------------
  function initSecondaryScroll() {
    const scrollBtn = document.getElementById('kjuWatchKennyBtn');
    if (scrollBtn) {
      scrollBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const videoSec = document.getElementById('kenny-video-stage') || document.getElementById('kenny-video-section');
        if (videoSec) {
          videoSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }

  // --------------------------------------------------------------------------
  // 7. STICKY NAVBAR GLASSMORPHIC TRANSITION
  // --------------------------------------------------------------------------
  function initStickyNavbar() {
    const header = document.querySelector('.kju-header');
    if (!header) return;

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (window.scrollY > 80) {
            header.classList.add('is-scrolled');
          } else {
            header.classList.remove('is-scrolled');
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // initial check
  }

  // --------------------------------------------------------------------------
  // 7b. SECTION 04 WATERMARK PARALLAX DRIFT
  // --------------------------------------------------------------------------
  function initWatermarkParallax() {
    const introSection = document.getElementById('intro-section');
    const watermark = introSection ? introSection.querySelector('.kju-watermark-text') : null;
    if (!introSection || !watermark) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const rect = introSection.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            const progress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
            const shiftY = (progress - 0.5) * 36;
            const scale = 1 + (progress - 0.5) * 0.03;
            watermark.style.transform = `translate(-50%, calc(-50% + ${shiftY}px)) scale(${scale})`;
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // --------------------------------------------------------------------------
  // 8. SCROLL-TRIGGERED REVEALS (INTERSECTION OBSERVER)
  // --------------------------------------------------------------------------
  function initScrollReveals() {
    const revealElements = document.querySelectorAll('.kju-reveal');
    if (!revealElements.length) return;

    if (!('IntersectionObserver' in window)) {
      revealElements.forEach(el => el.classList.add('is-revealed'));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          obs.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -50px 0px',
      threshold: 0.12
    });

    revealElements.forEach(el => observer.observe(el));
  }

  // --------------------------------------------------------------------------
  // 9. SEQUENTIAL PROTOCOL PIPELINE & STEPPER MECHANICS
  // --------------------------------------------------------------------------
  function initTimelineAnimation() {
    const wrapper = document.getElementById('kjuTimelineWrapper');
    const progressBar = document.getElementById('kjuTimelineProgressFill');
    const track = document.getElementById('kjuTimelineTrack');
    const steps = document.querySelectorAll('#kjuTimelineTrack .pipeline-step');
    const ctaBtn = document.getElementById('kjuPipelineCta');
    if (!wrapper || !steps.length) return;

    const stepPercentages = [0, 33.333, 66.666, 100];

    function setPipelineProgress(stepIndex) {
      const pct = stepPercentages[stepIndex] !== undefined ? stepPercentages[stepIndex] : 0;
      if (progressBar) {
        progressBar.style.setProperty('--pipeline-fill', `${pct}%`);
        progressBar.style.width = `${pct}%`;
      }

      steps.forEach((step, idx) => {
        if (idx === stepIndex) {
          step.classList.add('is-active');
          step.classList.remove('is-dimmed');
          step.classList.remove('is-illuminated');
        } else if (idx < stepIndex) {
          step.classList.add('is-illuminated');
          step.classList.remove('is-dimmed', 'is-active');
        } else {
          step.classList.add('is-dimmed');
          step.classList.remove('is-active', 'is-illuminated');
        }
      });
    }

    function resetPipeline() {
      if (progressBar) {
        progressBar.style.setProperty('--pipeline-fill', '0%');
        progressBar.style.width = '0%';
      }
      steps.forEach((step, idx) => {
        step.classList.remove('is-dimmed', 'is-illuminated');
        if (idx === 0) {
          step.classList.add('is-active');
        } else {
          step.classList.remove('is-active');
        }
      });
    }

    // Interactive Hover per Step
    steps.forEach((step, idx) => {
      step.addEventListener('mouseenter', () => {
        setPipelineProgress(idx);
      });
    });

    if (track) {
      track.addEventListener('mouseleave', () => {
        resetPipeline();
      });
    }

    // Coordinated Button Micro-Interaction (hovering CTA pulses Step 01)
    if (ctaBtn) {
      const step1 = steps[0];
      ctaBtn.addEventListener('mouseenter', () => {
        if (step1) step1.classList.add('is-btn-pulsing');
      });
      ctaBtn.addEventListener('mouseleave', () => {
        if (step1) step1.classList.remove('is-btn-pulsing');
      });
    }

    // Entrance Choreography (Scroll-Triggered)
    if (!('IntersectionObserver' in window)) {
      wrapper.classList.add('is-revealed');
      resetPipeline();
      return;
    }

    let animated = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !animated) {
          animated = true;
          wrapper.classList.add('is-revealed');
          resetPipeline();
        }
      });
    }, { threshold: 0.2 });

    observer.observe(wrapper);
  }

  // --------------------------------------------------------------------------
  // 9b. AUTHENTIC INSTITUTIONAL TRUST BAR ANIMATION & COUNT-UP ROLLING
  // --------------------------------------------------------------------------
  function initTrustRailAnimation() {
    const rail = document.getElementById('kjuTrustRail');
    if (!rail) return;

    let hasRun = false;

    function runAssemblyAndCounters() {
      if (hasRun) return;
      hasRun = true;

      // 1. Trigger Card Assembly (border, background, dividers scaleY, metrics reveal)
      rail.classList.add('is-assembled');

      // Check reduced motion preference
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (prefersReducedMotion) return;

      const duration = 1200; // 1.2s ease-out curve per specification
      const startTime = performance.now();

      const countCol1 = rail.querySelector('.kju-trust-rail-col[data-col="1"] .kju-trust-count');
      const countCol2 = rail.querySelector('.kju-trust-rail-col[data-col="2"] .kju-trust-count');
      const col3Spring = rail.querySelector('.kju-spring-target');

      // Spring bounce for 1-on-1
      if (col3Spring) {
        setTimeout(() => {
          col3Spring.classList.add('is-bounced');
        }, 380);
      }

      // Quartic ease-out: starts briskly and decelerates with high precision
      function easeOutQuart(x) {
        return 1 - Math.pow(1 - x, 4);
      }

      function updateRollup(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const ease = easeOutQuart(progress);

        if (countCol1) {
          const val1 = Math.round(10000 * ease);
          countCol1.textContent = val1.toLocaleString('en-US');
        }

        if (countCol2) {
          const val2 = Math.round(100 * ease);
          countCol2.textContent = val2;
        }

        if (progress < 1) {
          requestAnimationFrame(updateRollup);
        } else {
          if (countCol1) countCol1.textContent = (10000).toLocaleString('en-US');
          if (countCol2) countCol2.textContent = '100';
        }
      }

      requestAnimationFrame(updateRollup);
    }

    if (!('IntersectionObserver' in window)) {
      runAssemblyAndCounters();
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          runAssemblyAndCounters();
          obs.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px'
    });

    observer.observe(rail);
  }

  // --------------------------------------------------------------------------
  // 10. SOCIAL MEDIA ROLL-UP COUNTERS
  // --------------------------------------------------------------------------
  function initRollupCounters() {
    const counters = document.querySelectorAll('.kju-rollup-counter');
    if (!counters.length) return;

    if (!('IntersectionObserver' in window)) {
      counters.forEach(c => c.textContent = c.dataset.target);
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const counter = entry.target;
          const target = parseInt(counter.dataset.target, 10) || 0;
          let current = 0;
          const duration = 1400; // ms
          const stepTime = 25;
          const stepsCount = duration / stepTime;
          const increment = target / stepsCount;

          const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
              counter.textContent = target;
              clearInterval(timer);
            } else {
              counter.textContent = Math.floor(current);
            }
          }, stepTime);

          obs.unobserve(counter);
        }
      });
    }, { threshold: 0.4 });

    counters.forEach(c => observer.observe(c));
  }

  // --------------------------------------------------------------------------
  // 11. 3D COVERFLOW / PERSPECTIVE DEPTH STACK
  // --------------------------------------------------------------------------
  function initCoverflow() {
    const stage = document.getElementById('kjuCoverflowStage');
    const track = document.getElementById('kjuCoverflowTrack');
    const cards = Array.from(document.querySelectorAll('.kju-coverflow-card'));
    const prevBtn = document.getElementById('kjuCoverflowPrev');
    const nextBtn = document.getElementById('kjuCoverflowNext');
    const trackArea = document.getElementById('kjuScrubberTrack');
    const progressEl = document.getElementById('kjuScrubberProgress');
    const pillEl = document.getElementById('kjuScrubberPill');
    const readoutNum = document.getElementById('kjuReadoutCurrent');
    const wrapper = document.getElementById('kjuCoverflowWrapper');

    if (!stage || !track || !cards.length) return;

    let currentIndex = 0;
    const total = cards.length;

    // Check reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Update 3D card layout based on active index
    function updateCoverflowLayout() {
      cards.forEach((card, idx) => {
        let diff = idx - currentIndex;
        // Circular wrapping for smooth infinite carousel
        if (diff > total / 2) diff -= total;
        if (diff < -total / 2) diff += total;

        // Clear inline tilt styles from mouse parallax
        card.style.removeProperty('rotateX');
        card.style.removeProperty('rotateY');

        const glare = card.querySelector('.kju-card-glare');
        if (glare) glare.style.opacity = '0';

        if (diff === 0) {
          // Active Center Card (i = 0)
          card.classList.add('is-active');
          card.style.transform = prefersReducedMotion 
            ? 'translateX(0%) scale(1)' 
            : 'translateX(0%) translateZ(0px) rotateY(0deg) scale(1)';
          card.style.zIndex = '10';
          card.style.opacity = '1';
          card.style.filter = 'blur(0px)';
          card.style.pointerEvents = 'auto';
          card.setAttribute('aria-hidden', 'false');
        } else if (diff === -1) {
          // Immediate Left Card (i = -1)
          card.classList.remove('is-active');
          card.style.transform = prefersReducedMotion 
            ? 'translateX(-55%) scale(0.88)' 
            : 'translateX(-65%) translateZ(-180px) rotateY(28deg) scale(0.86)';
          card.style.zIndex = '5';
          card.style.opacity = '0.35';
          card.style.filter = 'blur(2.5px)';
          card.style.pointerEvents = 'auto';
          card.setAttribute('aria-hidden', 'true');
        } else if (diff === 1) {
          // Immediate Right Card (i = +1)
          card.classList.remove('is-active');
          card.style.transform = prefersReducedMotion 
            ? 'translateX(55%) scale(0.88)' 
            : 'translateX(65%) translateZ(-180px) rotateY(-28deg) scale(0.86)';
          card.style.zIndex = '5';
          card.style.opacity = '0.35';
          card.style.filter = 'blur(2.5px)';
          card.style.pointerEvents = 'auto';
          card.setAttribute('aria-hidden', 'true');
        } else {
          // Outer Cards (|i| >= 2)
          card.classList.remove('is-active');
          const sign = diff > 0 ? 1 : -1;
          const rot = diff > 0 ? -40 : 40;
          card.style.transform = prefersReducedMotion 
            ? `translateX(${sign * 95}%) scale(0.72)` 
            : `translateX(${diff * 85}%) translateZ(-320px) rotateY(${rot}deg) scale(0.72)`;
          card.style.zIndex = '1';
          card.style.opacity = '0';
          card.style.filter = 'blur(6px)';
          card.style.pointerEvents = 'none';
          card.setAttribute('aria-hidden', 'true');
        }
      });

      // Update Scrubber Position & Progress
      const pct = total > 1 ? (currentIndex / (total - 1)) * 100 : 0;
      if (progressEl) {
        progressEl.style.width = `${pct}%`;
      }
      if (pillEl) {
        pillEl.style.left = `${pct}%`;
        pillEl.classList.add('is-sliding');
        clearTimeout(pillEl._slideTimeout);
        pillEl._slideTimeout = setTimeout(() => {
          pillEl.classList.remove('is-sliding');
        }, 220);
      }

      // Update Numeric Readout with Flip Transition
      if (readoutNum) {
        readoutNum.classList.add('is-flipping');
        setTimeout(() => {
          readoutNum.textContent = String(currentIndex + 1).padStart(2, '0');
          readoutNum.classList.remove('is-flipping');
        }, 110);
      }
    }

    function goToSlide(index) {
      if (index === currentIndex) return;
      // Wrap around seamlessly
      currentIndex = (index + total) % total;
      updateCoverflowLayout();
    }

    // Direct click to center
    cards.forEach((card, idx) => {
      card.addEventListener('click', () => {
        if (idx !== currentIndex) {
          goToSlide(idx);
        }
      });
    });

    // Arrow Controls
    if (prevBtn) {
      prevBtn.addEventListener('click', () => goToSlide(currentIndex - 1));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => goToSlide(currentIndex + 1));
    }

    // Timeline Scrubber Track Click
    if (trackArea) {
      trackArea.addEventListener('click', (e) => {
        const rect = trackArea.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        const targetIndex = Math.round(ratio * (total - 1));
        goToSlide(targetIndex);
      });
    }

    // Interactive Mouse Parallax Tilt on Active Card (Desktop)
    function handleMouseMove(e) {
      if (prefersReducedMotion || window.innerWidth < 768) return;
      const activeCard = cards[currentIndex];
      if (!activeCard) return;

      const rect = activeCard.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Mathematical formulas from blueprint:
      // rotX = -((Y - Ycenter) / (H / 2)) * 8deg
      // rotY = ((X - Xcenter) / (W / 2)) * 8deg
      const rotX = -((y - centerY) / centerY) * 8;
      const rotY = ((x - centerX) / centerX) * 8;

      activeCard.style.transform = `translateX(0%) translateZ(0px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`;

      const glare = activeCard.querySelector('.kju-card-glare');
      if (glare) {
        glare.style.opacity = '1';
        glare.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255, 255, 255, 0.42) 0%, transparent 60%)`;
      }
    }

    function handleMouseLeave() {
      if (prefersReducedMotion || window.innerWidth < 768) return;
      const activeCard = cards[currentIndex];
      if (!activeCard) return;

      activeCard.style.transform = 'translateX(0%) translateZ(0px) rotateY(0deg) scale(1)';
      const glare = activeCard.querySelector('.kju-card-glare');
      if (glare) glare.style.opacity = '0';
    }

    stage.addEventListener('mousemove', (e) => {
      const activeCard = cards[currentIndex];
      if (activeCard && activeCard.contains(e.target)) {
        handleMouseMove(e);
      } else {
        handleMouseLeave();
      }
    });

    stage.addEventListener('mouseleave', handleMouseLeave);

    // Keyboard Navigation
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') {
        goToSlide(currentIndex - 1);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        goToSlide(currentIndex + 1);
        e.preventDefault();
      }
    });

    // Touch / Swipe Navigation
    let touchStartX = 0;
    let touchStartY = 0;
    stage.addEventListener('touchstart', (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    stage.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;

      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          goToSlide(currentIndex + 1);
        } else {
          goToSlide(currentIndex - 1);
        }
      }
    }, { passive: true });

    // Initial Layout Setup
    updateCoverflowLayout();

    // Entrance Choreography with IntersectionObserver
    if (wrapper && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            wrapper.classList.add('is-revealed');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.2 });

      observer.observe(wrapper);
    }
  }

  // --------------------------------------------------------------------------
  // 12. INTERACTIVE GOAL SELECTOR & DYNAMIC PREVIEW CONSOLE
  // --------------------------------------------------------------------------
  function initGoalSelector() {
    const tiles = document.querySelectorAll('.kju-milestone-strip, .kju-goal-tile');
    const badgeEl = document.getElementById('kjuGoalBadge');
    const titleEl = document.getElementById('kjuGoalTitle');
    const approvedTextEl = document.getElementById('kjuGoalApprovedText');
    const ctaBtnEl = document.getElementById('kjuGoalCtaBtn');
    const stageEl = document.getElementById('kjuVaultStage') || document.getElementById('kjuGoalPreviewConsole');
    const catalogEl = document.querySelector('.kju-milestone-catalog');
    const vaultEl = document.querySelector('.kju-milestone-vault');

    if (!tiles.length || !titleEl) return;

    const goalData = {
      home: {
        badge: 'MORTGAGE READINESS & PRIME LENDING',
        title: 'Buying a Home',
        approvedText: '“Your credit can play an important role when lenders evaluate a mortgage application.”',
        ctaText: 'DISCUSS MY HOME FINANCING GOAL'
      },
      auto: {
        badge: 'VEHICLE FINANCING & APR PROTECTION',
        title: 'Financing a Vehicle',
        approvedText: '“A stronger credit profile may give you access to more borrowing options.”',
        ctaText: 'DISCUSS MY VEHICLE FINANCING GOAL'
      },
      cards: {
        badge: 'REVOLVING PRODUCTS & PREMIUM PERKS',
        title: 'Better Credit Products',
        approvedText: '“Your credit history can influence which cards and credit products you qualify for.”',
        ctaText: 'DISCUSS MY CREDIT PRODUCT GOALS'
      },
      borrowing: {
        badge: 'BORROWING OPTIONS & NEGOTIATION POWER',
        title: 'Better Borrowing Options',
        approvedText: '“Creditworthiness can influence the rates and terms lenders are willing to offer.”',
        ctaText: 'DISCUSS MY BORROWING OPTIONS'
      },
      profile: {
        badge: 'LONG-TERM RESILIENCE & PROFILE HEALTH',
        title: 'Building a Stronger Profile',
        approvedText: '“Maybe you don’t need financing today. You simply want to put yourself in a stronger position for the future.”',
        ctaText: 'BUILD MY CREDIT STRENGTH STRATEGY'
      },
      options: {
        badge: 'FINANCIAL AUTONOMY & LIFE OPPORTUNITY',
        title: 'Creating Financial Options',
        approvedText: '“Credit isn’t everything. But when you need it, you want your credit working for you, not against you.”',
        ctaText: 'EXPAND MY FINANCIAL OPTIONS'
      }
    };

    function syncVaultHeight() {
      if (!catalogEl || !vaultEl) return;
      if (window.innerWidth >= 992) {
        vaultEl.style.height = '';
        vaultEl.style.maxHeight = '';
        const h = catalogEl.offsetHeight;
        if (h > 0) {
          vaultEl.style.height = h + 'px';
          vaultEl.style.maxHeight = h + 'px';
        }
      } else {
        vaultEl.style.height = '';
        vaultEl.style.maxHeight = '';
      }
    }

    function adjustQuoteTextSize(text) {
      if (!approvedTextEl) return;
      approvedTextEl.textContent = text;
      if (text.length > 95) {
        approvedTextEl.style.fontSize = 'clamp(0.92rem, 1.15vw, 1.05rem)';
        approvedTextEl.style.lineHeight = '1.45';
      } else {
        approvedTextEl.style.fontSize = 'clamp(1.02rem, 1.25vw, 1.18rem)';
        approvedTextEl.style.lineHeight = '1.55';
      }
    }

    function adjustButtonTextSize(btnText) {
      if (!ctaBtnEl) return;
      const span = ctaBtnEl.querySelector('span');
      if (!span) return;
      if (btnText) span.textContent = btnText;

      const text = span.textContent || '';
      if (text.length > 31) {
        span.style.fontSize = 'clamp(0.58rem, 0.68vw, 0.66rem)';
        span.style.letterSpacing = '0.025em';
      } else if (text.length > 28) {
        span.style.fontSize = 'clamp(0.61rem, 0.71vw, 0.68rem)';
        span.style.letterSpacing = '0.035em';
      } else {
        span.style.fontSize = 'clamp(0.64rem, 0.74vw, 0.70rem)';
        span.style.letterSpacing = '0.035em';
      }

      requestAnimationFrame(() => {
        const btnWidth = ctaBtnEl.clientWidth;
        if (!btnWidth) return;
        const icon = ctaBtnEl.querySelector('i');
        const iconWidth = icon ? icon.offsetWidth + 12 : 22;
        const availableWidth = btnWidth - iconWidth - 32;

        if (availableWidth > 0 && span.scrollWidth > availableWidth) {
          let currentSize = parseFloat(window.getComputedStyle(span).fontSize);
          while (span.scrollWidth > availableWidth && currentSize > 8.5) {
            currentSize -= 0.5;
            span.style.fontSize = currentSize + 'px';
            span.style.letterSpacing = '0.015em';
          }
        }
      });
    }

    // Initialize text sizing and height sync
    adjustQuoteTextSize(goalData.home.approvedText);
    adjustButtonTextSize(goalData.home.ctaText);
    syncVaultHeight();

    window.addEventListener('resize', () => {
      syncVaultHeight();
      adjustButtonTextSize();
    });
    window.addEventListener('load', syncVaultHeight);

    function updateGoalConsole(goalKey) {
      const data = goalData[goalKey];
      if (!data) return;

      if (!stageEl) return;

      // 1. Exit upward with quick fade
      stageEl.style.transition = 'opacity 0.16s ease, transform 0.16s ease';
      stageEl.style.opacity = '0';
      stageEl.style.transform = 'translateY(-8px)';

      setTimeout(() => {
        if (badgeEl) badgeEl.textContent = data.badge;
        if (titleEl) titleEl.textContent = data.title;
        adjustQuoteTextSize(data.approvedText);
        adjustButtonTextSize(data.ctaText);

        // Keep height locked strictly to the left catalog
        syncVaultHeight();

        // 2. Position below before reveal
        stageEl.style.transform = 'translateY(8px)';

        requestAnimationFrame(() => {
          // 3. Smooth entrance from below
          stageEl.style.transition = 'opacity 0.32s cubic-bezier(0.16, 1, 0.3, 1), transform 0.32s cubic-bezier(0.16, 1, 0.3, 1)';
          stageEl.style.opacity = '1';
          stageEl.style.transform = 'translateY(0)';
        });
      }, 160);
    }

    tiles.forEach(tile => {
      const selectGoal = () => {
        const goalKey = tile.dataset.goal;
        tiles.forEach(t => {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        tile.classList.add('is-active');
        tile.setAttribute('aria-selected', 'true');
        updateGoalConsole(goalKey);
      };

      tile.addEventListener('click', selectGoal);
      tile.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectGoal();
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // 13. DOSSIER COMMAND CARD CURSOR LIGHTING
  // --------------------------------------------------------------------------
  function initDossierLighting() {
    const panel = document.querySelector('.kju-dossier-panel');
    if (!panel) return;

    panel.addEventListener('mousemove', (e) => {
      const rect = panel.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      panel.style.setProperty('--dossier-mouse-x', `${x}px`);
      panel.style.setProperty('--dossier-mouse-y', `${y}px`);
      panel.style.setProperty('--dossier-glare-opacity', '1');
    }, { passive: true });

    panel.addEventListener('mouseleave', () => {
      panel.style.setProperty('--dossier-glare-opacity', '0');
    });
  }

  // --------------------------------------------------------------------------
  // 14. FOUNDER DOSSIER 3D TILT MICRO-INTERACTION (SECTION 11)
  // --------------------------------------------------------------------------
  function initFounderDossierTilt() {
    const card = document.querySelector('.kju-founder-dossier-card');
    if (!card) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    let isHovering = false;

    card.addEventListener('mouseenter', () => {
      isHovering = true;
    });

    card.addEventListener('mousemove', (e) => {
      if (!isHovering) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = (((y - centerY) / centerY) * -4).toFixed(2);
      const rotateY = (((x - centerX) / centerX) * 4).toFixed(2);

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
    }, { passive: true });

    card.addEventListener('mouseleave', () => {
      isHovering = false;
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    });
  }

  // --------------------------------------------------------------------------
  // 15. FLIPPABLE CARD DECK CONTROLLER — SECTION 10
  // --------------------------------------------------------------------------
  function initHorizonBlades() {
    const track = document.getElementById('kjuHorizonTrack');
    if (!track) return;

    const cards = Array.from(track.querySelectorAll('.kju-flip-card'));
    const flipAllBtn = document.getElementById('kjuDeckFlipAllBtn');
    let isTrackRevealed = false;

    // --- Card Click / Tap & Keyboard Handling ---
    cards.forEach((card, index) => {
      // Click or tap toggles flip state
      card.addEventListener('click', (e) => {
        // Prevent toggle if clicking a specific action link if any
        card.classList.toggle('is-flipped');
        const isFlipped = card.classList.contains('is-flipped');
        card.setAttribute('aria-expanded', isFlipped ? 'true' : 'false');
      });

      // Keyboard navigation
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.classList.toggle('is-flipped');
          const isFlipped = card.classList.contains('is-flipped');
          card.setAttribute('aria-expanded', isFlipped ? 'true' : 'false');
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          const next = (index + 1) % cards.length;
          cards[next].focus();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          const prev = (index - 1 + cards.length) % cards.length;
          cards[prev].focus();
        }
      });
    });

    // --- "Flip All Cards" Deck Controller ---
    if (flipAllBtn) {
      flipAllBtn.addEventListener('click', () => {
        const isAllFlipped = track.classList.toggle('is-all-flipped');
        cards.forEach(c => {
          c.classList.remove('is-flipped');
          c.setAttribute('aria-expanded', isAllFlipped ? 'true' : 'false');
        });

        const btnText = flipAllBtn.querySelector('.btn-text');
        const btnIcon = flipAllBtn.querySelector('i');
        if (btnText) {
          btnText.textContent = isAllFlipped ? 'RESET CARDS' : 'FLIP ALL CARDS';
        }
        if (btnIcon) {
          btnIcon.className = isAllFlipped ? 'fa-solid fa-arrows-rotate' : 'fa-solid fa-layer-group';
        }
      });
    }

    // --- Entrance reveal via IntersectionObserver ---
    if (!('IntersectionObserver' in window)) {
      track.classList.add('is-revealed');
      isTrackRevealed = true;
      return;
    }

    const trackObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !isTrackRevealed) {
          isTrackRevealed = true;
          track.classList.add('is-revealed');
          obs.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: '0px 0px -60px 0px',
      threshold: 0.1
    });

    trackObserver.observe(track);
  }

  // --------------------------------------------------------------------------
  // 17. WHY CHOOSE KJU BENTO CURSOR LIGHTING
  // --------------------------------------------------------------------------
  function initWhyBentoLighting() {
    const cards = document.querySelectorAll('#kjuWhyGrid .kju-why-card');
    if (!cards.length) return;

    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--why-glow-x', `${x}px`);
        card.style.setProperty('--why-glow-y', `${y}px`);
      }, { passive: true });
    });
  }

  // --------------------------------------------------------------------------
  // 18. BACK TO TOP DIRECT CONTROLLER
  // --------------------------------------------------------------------------
  function initBackToTop() {
    const btn = document.getElementById('kjuBackToTop');
    if (!btn) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (window.scrollY > 400) {
            btn.classList.add('is-visible');
          } else {
            btn.classList.remove('is-visible');
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }

  // --------------------------------------------------------------------------
  // 19. HEADER NAVIGATION & SCROLLSPY
  // --------------------------------------------------------------------------
  function initHeaderNavigation() {
    const navToggle = document.getElementById('kjuNavToggle');
    const headerNav = document.getElementById('kjuHeaderNav');
    const backdrop = document.getElementById('kjuNavBackdrop');

    if (navToggle && headerNav) {
      function openNav() {
        headerNav.classList.add('is-open');
        navToggle.classList.add('is-active');
        navToggle.setAttribute('aria-expanded', 'true');
        const icon = navToggle.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-xmark';
        if (backdrop) backdrop.classList.add('is-active');
        document.body.classList.add('kju-nav-locked');
      }

      function closeNav() {
        headerNav.classList.remove('is-open');
        navToggle.classList.remove('is-active');
        navToggle.setAttribute('aria-expanded', 'false');
        const icon = navToggle.querySelector('i');
        if (icon) icon.className = 'fa-solid fa-bars';
        if (backdrop) backdrop.classList.remove('is-active');
        document.body.classList.remove('kju-nav-locked');
      }

      navToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = headerNav.classList.contains('is-open');
        if (isOpen) {
          closeNav();
        } else {
          openNav();
        }
      });

      if (backdrop) {
        backdrop.addEventListener('click', closeNav);
      }

      // Close mobile nav when clicking any link
      headerNav.querySelectorAll('.kju-header-nav-link').forEach(link => {
        link.addEventListener('click', () => {
          closeNav();
        });
      });

      // Close mobile nav when clicking the CTA inside drawer
      const mobileCta = headerNav.querySelector('.kju-mobile-nav-cta-btn');
      if (mobileCta) {
        mobileCta.addEventListener('click', () => {
          closeNav();
        });
      }

      // Close when pressing Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && headerNav.classList.contains('is-open')) {
          closeNav();
        }
      });

      // Auto-close if resized to desktop viewport
      window.addEventListener('resize', () => {
        if (window.innerWidth > 991 && headerNav.classList.contains('is-open')) {
          closeNav();
        }
      });
    }

    // Scrollspy for index page anchor links
    const internalNavLinks = document.querySelectorAll('.kju-header-nav-link[href^="#"]');
    if (internalNavLinks.length && 'IntersectionObserver' in window) {
      const sectionMap = {};
      internalNavLinks.forEach(link => {
        const targetId = link.getAttribute('href').substring(1);
        const sectionEl = document.getElementById(targetId);
        if (sectionEl) sectionMap[targetId] = { el: sectionEl, link: link };
      });

      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const targetId = entry.target.id;
            internalNavLinks.forEach(link => {
              if (link.getAttribute('href') === `#${targetId}`) {
                link.classList.add('is-active');
              } else {
                link.classList.remove('is-active');
              }
            });
          }
        });
      }, {
        rootMargin: '-20% 0px -60% 0px',
        threshold: 0
      });

      Object.values(sectionMap).forEach(item => observer.observe(item.el));
    }
  }

  // --------------------------------------------------------------------------
  // 20. INITIALIZATION ON DOM READY
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initAttribution();
    trackEvent('page_view');
    initVideoGate();
    initOptionListeners();
    initFaqAccordion();
    initSecondaryScroll();
    initStickyNavbar();
    initHeaderNavigation();
    initWatermarkParallax();
    initScrollReveals();
    initTrustRailAnimation();
    initTimelineAnimation();
    initRollupCounters();
    initCoverflow();
    initGoalSelector();
    initDossierLighting();
    initFounderDossierTilt();
    initHorizonBlades();
    initWhyBentoLighting();
    initBackToTop();

    // Check deep-link hash (#fit-check)
    if (window.location.hash === '#fit-check') {
      openFitCheck();
    }
  });

})();


