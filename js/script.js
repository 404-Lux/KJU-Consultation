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
  const mobileStickyBar = document.getElementById('kjuMobileStickyBar');

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
    if (mobileStickyBar) mobileStickyBar.classList.add('is-hidden');

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
    if (mobileStickyBar && state.qualificationStatus !== 'QUALIFIED') {
      mobileStickyBar.classList.remove('is-hidden');
    }
  }

  function renderCurrentStep() {
    state.activeStepSequence = calculateStepSequence();
    const currentStepId = state.activeStepSequence[state.currentStepIndex];

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
      paidBtn.href = CONFIG.paidConsultationUrl;
      paidBtn.onclick = () => {
        trackEvent('paid_call_clicked', { reason: state.disqualificationReason });
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

  function loadCalendlyEmbed() {
    const container = document.getElementById('kjuCalendlyContainer');
    if (!container) return;

    trackEvent('calendly_viewed');

    const nameParam = encodeURIComponent(state.contact.fullName);
    const emailParam = encodeURIComponent(state.contact.email);
    const phoneParam = encodeURIComponent(state.contact.phone);

    const fullCalendlyUrl = `${CONFIG.calendlyBaseUrl}?name=${nameParam}&email=${emailParam}&a1=${phoneParam}&hide_gdpr_banner=1&background_color=0c121e&text_color=e8e4dc&primary_color=b8860b`;

    container.innerHTML = `
      <iframe
        src="${fullCalendlyUrl}"
        width="100%"
        height="650"
        frameborder="0"
        title="KJU Free Strategy Consultation"
        style="border-radius: 8px; background: #0C121E;"
      ></iframe>
    `;

    // Listen for Calendly booking postMessage
    window.addEventListener('message', (e) => {
      if (e.data && e.data.event && e.data.event === 'calendly.event_scheduled') {
        trackEvent('free_call_booked', { email: state.contact.email });
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
  // 9. TIMELINE PROGRESS & STEP ILLUMINATION
  // --------------------------------------------------------------------------
  function initTimelineAnimation() {
    const wrapper = document.getElementById('kjuTimelineWrapper');
    const progressBar = document.getElementById('kjuTimelineProgressFill');
    const steps = document.querySelectorAll('#kjuTimelineTrack .kju-how-card-step');
    if (!wrapper || !steps.length) return;

    if (!('IntersectionObserver' in window)) {
      if (progressBar) progressBar.style.width = '100%';
      steps.forEach(s => s.classList.add('is-active-step'));
      return;
    }

    let animated = false;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !animated) {
          animated = true;
          if (progressBar) {
            progressBar.style.width = '100%';
          }
          steps.forEach((step, idx) => {
            setTimeout(() => {
              step.classList.add('is-active-step');
            }, (idx + 1) * 260);
          });
        }
      });
    }, { threshold: 0.25 });

    observer.observe(wrapper);
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
  // 11. TESTIMONIAL CATEGORY FILTER TABS
  // --------------------------------------------------------------------------
  function initTestimonialFilter() {
    const filterButtons = document.querySelectorAll('.kju-filter-tab-btn');
    const cards = document.querySelectorAll('#kjuReviewsGrid .kju-review-card');
    if (!filterButtons.length || !cards.length) return;

    filterButtons.forEach(button => {
      button.addEventListener('click', () => {
        const filter = button.dataset.filter;

        filterButtons.forEach(btn => {
          btn.classList.remove('is-active');
          btn.setAttribute('aria-selected', 'false');
        });
        button.classList.add('is-active');
        button.setAttribute('aria-selected', 'true');

        cards.forEach(card => {
          const category = card.dataset.category;
          if (filter === 'all' || category === filter) {
            card.classList.remove('is-filtered-out');
            card.style.opacity = '0';
            card.style.transform = 'translateY(12px)';
            setTimeout(() => {
              card.style.transition = 'all 0.35s ease';
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
            }, 30);
          } else {
            card.classList.add('is-filtered-out');
          }
        });
      });
    });
  }

  // --------------------------------------------------------------------------
  // 12. INTERACTIVE GOAL SELECTOR & DYNAMIC PREVIEW CONSOLE
  // --------------------------------------------------------------------------
  function initGoalSelector() {
    const tiles = document.querySelectorAll('.kju-goal-tile');
    const badgeEl = document.getElementById('kjuGoalBadge');
    const titleEl = document.getElementById('kjuGoalTitle');
    const approvedTextEl = document.getElementById('kjuGoalApprovedText');
    const metricsListEl = document.getElementById('kjuGoalMetricsList');
    const ctaBtnEl = document.getElementById('kjuGoalCtaBtn');
    const consoleEl = document.getElementById('kjuGoalPreviewConsole');

    if (!tiles.length || !titleEl) return;

    const goalData = {
      home: {
        badge: 'MORTGAGE READINESS & PRIME LENDING',
        title: 'Buying a Home',
        icon: 'fa-house',
        approvedText: '“Your credit can play an important role when lenders evaluate a mortgage application.”',
        metrics: [
          '<strong>Interest Variance:</strong> A 1.0%–2.5% rate delta on standard Canadian mortgages',
          '<strong>Amortization Impact:</strong> Up to $80,000–$120,000+ in potential lifetime interest savings',
          '<strong>Lender Access:</strong> Qualifying with Canadian prime A-lenders vs. costly alternative debt'
        ],
        ctaText: 'DISCUSS MY HOME FINANCING GOAL'
      },
      auto: {
        badge: 'VEHICLE FINANCING & APR PROTECTION',
        title: 'Financing a Vehicle',
        icon: 'fa-car',
        approvedText: '“A stronger credit profile may give you access to more borrowing options.”',
        metrics: [
          '<strong>APR Spread:</strong> Prime auto rates (5%–8%) vs. high-cost subprime financing (16%–29%+)',
          '<strong>Monthly Savings:</strong> Reducing payments by $150–$350+/month on an identical vehicle',
          '<strong>Financing Health:</strong> Avoiding forced long-term negative equity rollovers'
        ],
        ctaText: 'DISCUSS MY VEHICLE FINANCING GOAL'
      },
      cards: {
        badge: 'REVOLVING PRODUCTS & PREMIUM PERKS',
        title: 'Better Credit Products',
        icon: 'fa-credit-card',
        approvedText: '“Your credit history can influence which cards and credit products you qualify for.”',
        metrics: [
          '<strong>Credit Limits:</strong> Eligibility for $10,000–$25,000+ primary unsecured limits',
          '<strong>Rewards & Travel:</strong> Access to premier 2%–4% cash-back and travel reward tiers',
          '<strong>Introductory Offers:</strong> Qualifying for 0% promotional balance transfer windows'
        ],
        ctaText: 'DISCUSS MY CREDIT PRODUCT GOALS'
      },
      borrowing: {
        badge: 'BORROWING OPTIONS & NEGOTIATION POWER',
        title: 'Better Borrowing Options',
        icon: 'fa-percent',
        approvedText: '“Creditworthiness can influence the rates and terms lenders are willing to offer.”',
        metrics: [
          '<strong>Unsecured Lines:</strong> Personal lines of credit at Prime + 1% to 3%',
          '<strong>Emergency Liquidity:</strong> Readily accessible credit when unexpected emergencies arise',
          '<strong>Lender Leverage:</strong> Greater power to negotiate fee waivers and competitive loan terms'
        ],
        ctaText: 'DISCUSS MY BORROWING OPTIONS'
      },
      profile: {
        badge: 'LONG-TERM RESILIENCE & PROFILE HEALTH',
        title: 'Building a Stronger Profile',
        icon: 'fa-shield',
        approvedText: '“Maybe you don’t need financing today. You simply want to put yourself in a stronger position for the future.”',
        metrics: [
          '<strong>Score Defense:</strong> Resilient scoring buffer against temporary utilization spikes',
          '<strong>Future Readiness:</strong> Positioned for major life milestones well before the need arises',
          '<strong>Bureau Longevity:</strong> Building a healthy, multi-year record with Equifax and TransUnion'
        ],
        ctaText: 'BUILD MY CREDIT STRENGTH STRATEGY'
      },
      options: {
        badge: 'FINANCIAL AUTONOMY & LIFE OPPORTUNITY',
        title: 'Creating Financial Options',
        icon: 'fa-door-open',
        approvedText: '“Credit isn’t everything. But when you need it, you want your credit working for you, not against you.”',
        metrics: [
          '<strong>Housing Mobility:</strong> Smooth tenant lease screening without requiring guarantors',
          '<strong>Deposit Waivers:</strong> Zero security deposits on utility connections and mobile plans',
          '<strong>Complete Autonomy:</strong> Moving through life with credit that opens doors instead of closing them'
        ],
        ctaText: 'EXPAND MY FINANCIAL OPTIONS'
      }
    };

    function updateGoalConsole(goalKey) {
      const data = goalData[goalKey];
      if (!data) return;

      if (consoleEl) {
        consoleEl.style.opacity = '0.5';
      }

      setTimeout(() => {
        if (badgeEl) badgeEl.textContent = data.badge;
        if (titleEl) titleEl.innerHTML = `<i class="fa-solid ${data.icon}"></i> ${data.title}`;
        if (approvedTextEl) approvedTextEl.textContent = data.approvedText;
        if (metricsListEl) {
          metricsListEl.innerHTML = data.metrics.map(m => `<li><i class="fa-solid fa-check"></i> ${m}</li>`).join('');
        }
        if (ctaBtnEl) {
          const span = ctaBtnEl.querySelector('span');
          if (span) span.textContent = data.ctaText;
        }
        if (consoleEl) {
          consoleEl.style.opacity = '1';
        }
      }, 150);
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
  // 13. INITIALIZATION ON DOM READY
  // --------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    initAttribution();
    trackEvent('page_view');
    initVideoGate();
    initOptionListeners();
    initFaqAccordion();
    initSecondaryScroll();
    initStickyNavbar();
    initScrollReveals();
    initTimelineAnimation();
    initRollupCounters();
    initTestimonialFilter();
    initGoalSelector();

    // Check deep-link hash (#fit-check)
    if (window.location.hash === '#fit-check') {
      openFitCheck();
    }
  });

})();
