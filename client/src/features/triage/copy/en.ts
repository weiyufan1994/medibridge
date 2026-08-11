export const triageCopyEn = {
  common: {
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    select_book: "Select & Book",
    view_profile: "View Profile",
    doctor_placeholder: "Doctor",
    specialty_unavailable: "Specialty information unavailable",
    unnamed_patient: "Unnamed patient",
    no_summary_available: "No summary available.",
  },
  triage_card: {
    summary: "Triage Summary",
    possibility: "Likely Direction",
    recommended_department: "Suggested Department",
    recommended_hospitals: "Reference Hospitals",
    next_step_title:
      "AI has completed an initial triage. Please choose a hospital to continue referral assistance.",
    next_step_description:
      "If the information looks correct, click a hospital below to continue. If you need to add more details, start a new triage session.",
    not_diagnosis:
      "This triage result is routing guidance only. It does not confirm a diagnosis.",
    browse_hospital: "Review service and place order",
    reduced_confidence_title: "Key information is still missing",
    reduced_confidence_description: (fields: string[]) =>
      `This is a preliminary routing suggestion. Please add ${fields.join(", ")} and any related symptoms to improve accuracy.`,
    critical_field_labels: {
      age: "age",
      gender: "gender",
    },
    platform_match: "In platform database",
    manual_coordination: "Manual coordination available",
    no_hospitals:
      "No reference hospitals are available yet. Please start a new triage session with more details.",
    possibility_fallback:
      "The current details suggest a broad specialty direction for in-person evaluation.",
    department_fallback: "Relevant department",
  },
  summary_form: {
    title: "AI-Organized Symptom Summary",
    description:
      "I organized your description into a structured summary. Please review and adjust anything that feels inaccurate before the next step.",
    age_gender: "Age / Gender",
    main_symptom_and_location: "Main Symptom & Location",
    duration_and_onset: "Duration & Onset",
    trauma_or_surgery: "Trauma & Surgery History",
    medical_history: "Key Underlying Conditions",
    other_symptoms: "Other Symptoms",
  },
  interruption: {
    eyebrow: "Urgent Safety Notice",
    title: "AI triage stopped due to high-risk symptoms",
    description:
      "The details you shared may suggest an urgent medical issue. Please avoid waiting in chat and seek in-person medical care immediately.",
    next_steps_title: "Recommended next steps",
    next_steps: [
      "Contact local emergency services right away if symptoms are sudden, severe, or rapidly worsening.",
      "If emergency services are not needed, go to the nearest emergency department or urgent care now.",
      "Bring your symptom timeline, medications, allergies, and any recent test results if available.",
    ],
    primary_cta: "Browse hospitals",
    secondary_cta: "Back to home",
    footer:
      "This safety stop is intended to reduce delay when urgent symptoms may be present.",
  },
  sidebar: {
    new_session: "New Session",
    today: "Today",
    previous_7_days: "Previous 7 Days",
    older: "Older",
    load_failed:
      "Failed to load session history. Please refresh and try again.",
    empty: "No previous sessions.",
    no_messages_in_session: "No messages in this session.",
    read_only_placeholder: "This is a past session (read-only)...",
  },
  status: {
    typing: "AI is typing...",
    reviewing: "AI is reviewing your triage details...",
    thinking: "AI is thinking...",
    quota_login_required:
      "Guest trial quota reached. Please sign in to continue triage.",
    message_limit_reached:
      "This consultation has reached the message limit. Please review the suggested department and hospitals now.",
    message_limit_action: "Continue with hospital selection",
  },
  patientLabel: "Patient",
  triage: {
    disclaimer:
      "AI can make mistakes. Always consult a professional doctor before making medical decisions.",
    post_complete_input_title: "Hospital selection is the main next step",
    post_complete_input_description:
      "The triage result is ready. Please prioritize clicking a hospital above to continue; if you need to add more symptoms, start a new triage session.",
  },
  doctor_detail: {
    about: "About Doctor",
    biography: "Biography",
    confirm_book: "Confirm & Book",
    years_experience: (years: number) => `${years} years experience`,
  },
  fast_intake: {
    title: "Quick Form (Optional)",
    description:
      "If chatting is inconvenient, you can switch to a short form. The default path is still AI-guided triage in 2-3 turns.",
    age: "Age",
    gender: "Gender",
    gender_placeholder: "Select gender",
    gender_male: "Male",
    gender_female: "Female",
    gender_other: "Other",
    gender_unknown: "Prefer not to say",
    main_symptom: "Main Symptom & Location",
    main_symptom_placeholder:
      "e.g. right lower abdominal pain / chest tightness / skin wound on the leg",
    duration_onset: "Duration & Onset",
    duration_onset_placeholder:
      "e.g. sudden since this morning / worsening for 3 days / recurring for 2 months",
    trauma_surgery: "Trauma & Surgery History",
    trauma_surgery_placeholder:
      "e.g. none / fell yesterday / had surgery recently",
    chronic_conditions: "Key Underlying Conditions",
    chronic_conditions_placeholder:
      "e.g. none / diabetes / hypertension / heart disease / cancer",
    submit: "Submit Quick Form",
    skip: "Keep Chatting",
    required: "Enter at least one key detail before submitting the form.",
  },
  title: "AI Triage Consultation",
  subtitle:
    "Describe your problem in your own words. AI will guide the conversation and recommend a department plus reference hospitals within 2-3 turns.",
  placeholder: "Describe your symptoms here...",
  typing: "AI is reviewing your triage details...",
  requestError:
    "Triage service is temporarily unavailable. Please try again shortly.",
  fallbackReply:
    "Sorry, the triage service is busy right now. Please try again in a moment.",
  completed:
    "Triage is complete. Your department and hospital recommendations are ready.",
  summaryTitle: "Triage Summary",
  summaryDesc: "A structured summary to carry into booking/session creation.",
  summaryEmpty: "Summary will appear after triage is complete.",
  doctorTitle: "Reference Hospitals",
  doctorDesc: "Top 5 hospitals ranked for the suggested department",
  searching: "Preparing routing result...",
  doctorQueryError:
    "Hospital recommendations failed to load. Please retry or refresh this session.",
  noDoctor:
    "No hospital recommendation is available yet. Try adding more specific symptom details.",
  noBio: "No profile details available yet.",
  viewProfile: "View Profile",
  chooseBook: "Choose & Book",
  whatsapp: "Book via WhatsApp",
  startNew: "Start New Session",
  disclaimerTitle: "Medical Disclaimer",
  disclaimerDesc:
    "AI suggestions are for triage and hospital routing only. They are not a diagnosis.",
  disclaimerLine1:
    "Do not share highly sensitive identity details (ID/passport numbers) in chat.",
  disclaimerLine2:
    "If you have severe chest pain, breathing distress, stroke signs, heavy bleeding, or any emergency symptoms, call local emergency services immediately.",
  cancel: "Cancel",
  understand: "I Understand",
  rating: "Rating",
  doctorFallback: "Reference Hospital",
  bookingTitle: "Book Appointment",
  bookingDesc:
    "Provide email and preferred time to receive a secure magic link.",
  bookingEmail: "Email",
  bookingTime: "Scheduled Time",
  bookingType: "Appointment Type",
  bookingTypeOnline: "Online Chat",
  bookingTypeVideo: "Video Call",
  bookingTypeInPerson: "In Person",
  bookingCancel: "Cancel",
  bookingConfirm: "Create Booking",
  bookingCreating: "Creating...",
  bookingInvalid: "Please complete email and time.",
  bookingSuccess: "Booking created. Redirecting to checkout...",
  bookingFailed: "Failed to create booking. Please try again.",
  bookingEmailPlaceholder: "you@example.com",
  bookingOtpLabel: "Email Verification Code",
  bookingOtpPlaceholder: "Enter 6-digit code",
  bookingSendOtp: "Send code",
  bookingSendingOtp: "Sending...",
  bookingResendOtp: "Resend code",
  bookingOtpSent: "Verification code sent. Please check your email.",
  bookingOtpCooldown: "Retry in {seconds}s",
  bookingOtpRequired: "Please enter the 6-digit verification code.",
  bookingVerifyingIdentity: "Verifying identity...",
  bookingIdentityVerified: "Email verified.",
  bookingIdentityVerifyFailed: "Email verification failed. Please try again.",
  bookingDeviceIdMissing:
    "Cannot read device id. Please refresh and try again.",
  initialAssistantMessage:
    'If you are comfortable, please start with your age and gender. Then we can go through 4 quick questions so I can guide you faster: 1. What is the main symptom, and where is it located? 2. How long has it been happening, and did it start suddenly or gradually? 3. Is it related to any recent injury or surgery? 4. Do you have any important underlying conditions, such as diabetes, high blood pressure, heart disease, immune disorders, or cancer? If something does not apply, write "none".',
  reasonFallback: "Recommended based on triage details",
  bookingSummaryFallback: "Symptom details shared in AI chat.",
  bookingSymptomsFallback: "Shared in triage chat",
  bookingDurationFallback: "Unspecified",
} as const;
