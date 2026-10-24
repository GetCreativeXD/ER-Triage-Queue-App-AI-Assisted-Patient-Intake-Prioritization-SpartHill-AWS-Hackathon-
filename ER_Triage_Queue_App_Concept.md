# ER Triage Queue App Concept

## 1. Product Overview

The ER Triage Queue App is a patient-intake and triage-support application for patients who are already inside an emergency room. It collects information about the patient’s symptoms and current condition, then organizes patients into a priority queue so the triage nurse can quickly identify who should be evaluated first by an attending physician or resident.

The application supports two ways for a patient to complete intake:

- A guided form that the patient completes by typing or selecting answers.
- A conversational voice experience powered by Amazon Lex, allowing the patient to speak their responses.

The app continuously reflects changes in a patient’s reported condition. If a patient reports that their symptoms have worsened, improved, or changed, the queue priority can be recalculated and the triage nurse can receive a notification.

The system is intended to reduce repetitive communication, make patient status easier to monitor, and help nurses make faster, more informed scheduling decisions. It is a decision-support and communication tool; it does not replace professional medical assessment or emergency protocols.

## 2. Problem Statement

Emergency departments often have more patients waiting than staff can immediately evaluate. Patients may not know how to describe their symptoms, may have difficulty completing forms, or may not tell staff when their condition changes. Nurses must repeatedly collect information, monitor the waiting area, determine who needs attention first, and communicate updates to the care team.

This creates several challenges:

- Important changes in a patient’s condition may be missed.
- Patients may be unsure when or how to report worsening symptoms.
- Nurses spend time repeating intake questions and manually tracking updates.
- Patients have limited visibility into their current status.
- Language and accessibility barriers can delay communication.

The proposed application addresses these issues by providing a simple intake experience, a dynamic priority queue, and clear notifications for the triage nurse.

## 3. Goals

### Primary goals

1. Collect useful patient-reported information quickly and consistently.
2. Make the patient intake process understandable for people under stress.
3. Support multiple languages and voice-based interaction.
4. Give the triage nurse a real-time view of patient priority and status.
5. Automatically identify when a patient’s reported condition has changed.
6. Minimize unnecessary clicks and repeated data entry.
7. Keep the nurse in control of the final clinical prioritization decision.

### Secondary goals

- Provide patients with clear instructions about what to do if symptoms worsen.
- Reduce duplicate questions during the initial triage process.
- Create a clear audit trail of patient-reported updates and nurse actions.
- Provide a foundation for future integration with hospital systems.

## 4. Assumptions

- Patients are already physically present in the emergency room.
- The patient has been registered by the hospital or front-desk staff.
- The triage nurse already has an authenticated account.
- The patient has access to a hospital tablet, kiosk, phone, or other approved device.
- The application receives patient-reported information and does not independently diagnose the patient.
- The nurse remains responsible for confirming the patient’s condition and assigning the final triage priority.
- Emergency department policies and established emergency procedures take priority over the app.
- The initial hackathon version may use simulated patient and queue data instead of a production electronic health record connection.

## 5. Users and Roles

### Patient

The patient uses the application to:

- Select a language.
- Complete the intake questionnaire.
- Describe symptoms using text or speech.
- Answer follow-up questions.
- Report changes in their condition.
- View simple status information and instructions.

The patient should not be required to understand medical terminology.

### Triage nurse

The triage nurse uses the application to:

- View the current patient queue.
- See the reason each patient has been prioritized.
- Review patient-reported symptoms and changes.
- Receive alerts when a patient’s status changes.
- Confirm, raise, lower, pause, or override a queue priority.
- Mark a patient as seen, called, unavailable, transferred, or discharged from the waiting queue.

### Administrator or system owner

An administrator may eventually manage:

- Supported languages.
- Question sets.
- Priority rules and thresholds.
- User accounts and permissions.
- Notification settings.
- Audit and reporting settings.

Administrator functionality is outside the first MVP unless time permits.

## 6. Patient Experience

### 6.1 Welcome and language selection

The introductory screen should be calm, high contrast, and easy to understand. It should offer two ways to select a language:

- Tap a language button.
- Say the language aloud through Amazon Lex.

The screen should include large buttons, clear icons, and a short instruction such as:

> Choose your language by tapping a button or saying the language you speak.

The app should remember the selected language during the intake session. A visible language button should remain available in case the patient needs to change it.

### 6.2 Patient identification

Because the patient is assumed to be registered already, the app should use the hospital-provided visit number, wristband code, appointment code, or a nurse-generated session code. The patient should not need to create a new account.

Possible options for the prototype:

- Scan a QR code provided by registration staff.
- Enter a short patient/session code.
- Select the patient from a nurse-created kiosk session.

The prototype should avoid displaying unnecessary personal information on a shared screen.

### 6.3 Intake form

The intake flow should ask only the questions needed to support initial triage. It should use one question per screen or a small group of related questions rather than presenting a long form.

Suggested sections:

1. Main reason for visiting.
2. Location of pain or symptoms.
3. Severity of pain or discomfort.
4. When the symptoms started.
5. Whether symptoms are getting better, worse, or staying the same.
6. Breathing difficulty, chest discomfort, fainting, confusion, severe bleeding, or other urgent warning signs.
7. Relevant medical conditions, allergies, medications, pregnancy possibility, or recent injuries when appropriate.
8. Free-text or spoken description of what happened.

The app should use plain-language questions and explain unfamiliar terms. It should support buttons, sliders, multiple choice, text input, and speech input depending on the question.

### 6.4 Voice intake through Amazon Lex

Amazon Lex can guide the patient through an interactive conversation. The bot should:

- Ask one question at a time.
- Confirm important answers.
- Repeat or rephrase a question when needed.
- Detect when the patient does not understand.
- Allow the patient to switch to typing.
- Recognize requests such as “go back,” “repeat that,” or “I need help.”
- Provide a clear completion message when the intake is submitted.

For safety, the system should show or read back important answers so the patient can correct transcription errors. Voice transcription should never be treated as perfectly reliable.

### 6.5 Condition updates

After the initial intake, the patient should see a simple option such as:

> Has your condition changed?

The patient can select:

- I feel worse.
- I feel better.
- My symptoms changed.
- I need help now.

The patient can then answer a short follow-up question and describe the change. The system records the time of the update and sends it to the nurse dashboard.

If a patient indicates a potentially life-threatening change, the app should display an immediate instruction to notify nearby staff or call for help. It should not rely only on the queue algorithm or a push notification.

## 7. Triage Nurse Experience

### 7.1 Nurse dashboard

The nurse dashboard should prioritize speed and scanability. The most important information should be visible without opening several screens.

Recommended dashboard elements:

- Number of waiting patients.
- Patients requiring immediate review.
- Newly submitted patients.
- Patients whose condition changed.
- Patients already called or being evaluated.
- Last update time.
- Current queue order.

Each patient row should show:

- Queue position.
- Patient/session identifier.
- Time waiting.
- Main complaint.
- Reported severity.
- Condition trend: worsening, stable, or improving.
- Alert level.
- Time since the last patient update.

### 7.2 Patient detail view

Selecting a patient should open a concise summary with expandable details. The nurse should be able to see:

- Patient-reported complaint.
- Symptom onset and duration.
- Pain or symptom severity.
- Warning-sign responses.
- Relevant medical information provided by the patient.
- Full text or transcript of the description.
- Timeline of updates.
- Current queue priority and reason.
- Nurse notes and actions.

The nurse should be able to confirm or change the system-recommended priority with one action.

### 7.3 Notifications

The nurse should receive notifications when:

- A new intake is submitted.
- A patient reports worsening symptoms.
- A patient’s calculated priority increases.
- A patient has waited beyond a configured threshold.
- A patient requests immediate help.
- The patient’s information is incomplete or needs confirmation.

Notifications should be grouped when possible to avoid overwhelming the nurse. High-severity alerts should remain visually distinct and should require acknowledgment.

## 8. Priority Queue Design

### 8.1 Queue principles

The queue should combine patient-reported information with waiting time and nurse review. It should not be a simple first-come, first-served list when a patient reports a serious change.

The system should produce a recommended priority category, while the nurse confirms the final order.

Example priority categories:

- Immediate review.
- Very urgent.
- Urgent.
- Standard.
- Low urgency.

The exact categories and rules should be configured with clinical leadership and validated against the hospital’s triage policy.

### 8.2 Factors that may affect recommended priority

Potential input factors include:

- Patient-reported severity.
- Worsening symptoms.
- Breathing difficulty.
- Chest discomfort.
- Fainting or altered mental state.
- Severe bleeding.
- Stroke-like symptoms.
- Severe allergic reaction symptoms.
- Major injury or trauma.
- Pregnancy-related concerns.
- Age group or vulnerability indicators.
- Time waiting.
- Nurse-entered observations.

These factors should be treated as signals for review, not as an automated diagnosis.

### 8.3 Queue update behavior

When a patient submits a new update:

1. The system records the response and timestamp.
2. The system evaluates the configured priority rules.
3. The system calculates a recommended priority.
4. The queue is reordered if appropriate.
5. The nurse receives an alert when the change is meaningful.
6. The nurse reviews and confirms or overrides the recommendation.
7. The patient receives a simple status update if permitted by hospital policy.

The system should display why the recommendation changed, for example:

> Priority increased because the patient reported worsening chest discomfort.

## 9. Minimizing Clicks

### Patient

- Use one primary action per screen.
- Keep answers selectable with large buttons.
- Remember previously entered information.
- Ask only relevant follow-up questions.
- Provide voice input as an alternative to typing.
- Include a persistent help or staff-assistance button.
- Avoid requiring account creation.

### Nurse

- Show the most important queue information in one dashboard.
- Allow priority confirmation directly from the queue row.
- Use quick actions such as Call, Seen, Escalate, Recheck, and Mark unavailable.
- Display the reason for a queue change without requiring a separate report.
- Allow keyboard shortcuts or tablet-friendly swipe actions where appropriate.
- Group low-priority notifications while keeping urgent alerts prominent.

## 10. Accessibility and Usability

The application should be usable by people experiencing pain, anxiety, fatigue, limited mobility, limited vision, or limited technical experience.

Recommended requirements:

- Large touch targets.
- High color contrast.
- Readable font sizes.
- Plain-language instructions.
- Screen-reader support where available.
- Text-to-speech for important instructions.
- Speech input and typed input at every major step.
- No information conveyed by color alone.
- Clear progress indicators.
- Ability to pause and resume intake.
- Ability to correct previous answers.
- Support for right-to-left languages where needed.
- Automatic timeout behavior that protects privacy on shared devices.

## 11. Safety and Clinical Boundaries

This application should be described as a triage-support tool, not a medical diagnosis system. The patient’s self-reported answers may be incomplete or inaccurate, and speech recognition may make transcription errors.

Safety requirements:

- The app must clearly instruct patients to notify nearby staff immediately for severe or rapidly worsening symptoms.
- The app must not tell a patient that they are safe to wait based only on an automated score.
- A nurse must be able to override the calculated queue position.
- The system must record whether a priority was system-recommended or nurse-confirmed.
- High-risk answers should create a visible nurse alert.
- The app should show the time of the last patient update.
- All changes should be logged for accountability.
- The queue should never prevent staff from responding to a patient directly.

## 12. Proposed Technical Architecture

### Patient application

- Responsive web application or tablet-friendly interface.
- Language selection and localized content.
- Typed intake form.
- Voice conversation through Amazon Lex.
- Patient status and update screen.

### Backend services

- API for patient sessions, intake responses, and condition updates.
- Authentication and role-based access for nurses.
- Queue calculation service.
- Notification service.
- Audit logging service.

### AWS services for the prototype

Possible services include:

- Amazon Lex for voice-based and conversational patient intake. Lex handles the patient conversation, speech recognition, prompts, confirmations, and collection of answers.
- Amazon Bedrock for AI-assisted text understanding. Bedrock can summarize the patient’s description, extract structured symptoms from free-text or voice responses, identify missing information, and generate a human-readable explanation of why a queue recommendation changed.
- Amazon API Gateway for backend API access.
- AWS Lambda for intake processing, queue updates, and notifications.
- Amazon DynamoDB for patient sessions, responses, queue entries, and audit records.
- Amazon SNS, Amazon EventBridge, or WebSocket messaging for nurse notifications and real-time updates.
- Amazon Cognito for nurse authentication.
- Amazon CloudWatch for monitoring and logs.

Amazon Transcribe is optional. Use it only if the implementation needs a separate speech-to-text workflow outside Amazon Lex.

### AI service responsibilities

The prototype should use the AWS AI services in clearly separated roles:

| Service | Responsibility |
| --- | --- |
| Amazon Lex | Voice interaction, speech recognition, language selection, conversational prompts, and collecting patient answers. |
| Amazon Bedrock | Summarizing patient descriptions, extracting structured symptom information, identifying missing details, and producing an explanation for a recommendation. |
| Deterministic application rules | Calculating the demo queue priority from defined warning signs, severity, symptom trend, and waiting time. |
| Triage nurse | Reviewing the patient information and confirming or overriding the final priority. |

Bedrock must not independently diagnose the patient or make an unreviewed final medical decision. The queue recommendation should remain based on transparent application rules, with Bedrock used as an assistive layer for organizing and explaining information. If Bedrock is unavailable, the application must continue using the patient’s raw answers and deterministic rules.

### Bedrock integration requirements

Create a service abstraction such as `BedrockService` with operations similar to:

```text
summarizePatientDescription(description, language)
extractSymptoms(description, language)
identifyMissingIntakeInformation(responses)
explainPriorityChange(previousData, currentData)
```

The Bedrock integration should:

- Use environment variables for model and AWS configuration.
- Keep all AWS credentials on the server side.
- Validate and constrain the model response to a known JSON schema.
- Handle timeout, unavailable-model, malformed-response, and rate-limit errors.
- Display AI-generated content as an assistant summary that the nurse can review.
- Preserve the original patient response alongside any AI-generated summary.
- Never allow an AI response to silently overwrite the patient’s original answer.
- Include a fallback path that uses the raw intake answers when Bedrock is not configured.

For the hackathon, use a Bedrock model that is available in the selected AWS region and account. Kiro should document the required model access, region, environment variables, and IAM permissions in `README.md` without committing credentials.

The final AWS design should be reviewed for hospital privacy, security, retention, and compliance requirements before real patient data is used.

## 13. Suggested Data Model

### Patient session

- Session ID.
- Hospital visit or registration reference.
- Preferred language.
- Created timestamp.
- Current status.
- Current queue position.
- Recommended priority.
- Nurse-confirmed priority.
- Last updated timestamp.

### Intake response

- Response ID.
- Session ID.
- Question identifier.
- Patient answer.
- Input method: typed, selected, or voice.
- Transcript confidence when available.
- Created timestamp.

### Condition update

- Update ID.
- Session ID.
- Description of change.
- Severity or warning-sign responses.
- Previous priority.
- New recommended priority.
- Nurse action.
- Created timestamp.

### Audit record

- User or system actor.
- Action performed.
- Patient/session reference.
- Previous value.
- New value.
- Timestamp.
- Reason or note.

## 14. MVP Scope for the Hackathon

The first version should focus on demonstrating the core value rather than building a complete hospital system.

### Include in the MVP

- Welcome screen with language selection.
- English plus one or two additional demonstration languages.
- Patient session creation using a simple code.
- Typed intake form.
- Amazon Lex voice intake for a limited set of questions.
- Patient symptom update flow.
- Nurse dashboard with a live queue.
- Queue reordering based on a simple, transparent priority rule set.
- Notifications when a patient’s priority changes.
- Nurse confirmation and override of priority.
- Demo data and a clear safety disclaimer.

### Defer until after the MVP

- Full hospital record integration.
- Production identity verification.
- Comprehensive translation coverage.
- Advanced analytics.
- Automatic medical diagnosis.
- Complex clinical decision support.
- Billing, scheduling, and discharge workflows.
- Full compliance certification.

## 15. Example End-to-End Workflow

1. Registration staff gives the patient a session code.
2. The patient opens the app and selects a language by tapping or speaking.
3. The patient enters the session code.
4. The app asks a short series of intake questions.
5. The patient answers by typing, selecting options, or speaking.
6. The app summarizes the answers for the patient to confirm.
7. The intake is submitted to the backend.
8. The patient appears in the nurse’s queue with a recommended priority.
9. The nurse reviews the summary and confirms or changes the priority.
10. The patient waits and can select the condition-update button.
11. The patient reports worsening symptoms.
12. The system records the update, recalculates the recommendation, and alerts the nurse.
13. The nurse reviews the alert and moves the patient higher in the queue or responds directly.
14. The nurse marks the patient as called or seen.

## 16. Success Metrics

The prototype can be evaluated using:

- Average time to complete intake.
- Number of clicks or screens required to complete intake.
- Percentage of patients who complete intake without staff assistance.
- Time between a patient update and nurse notification.
- Time required for a nurse to understand a patient’s situation.
- Number of queue changes correctly surfaced to the nurse.
- Patient and nurse usability feedback.
- Accuracy of speech transcription in the supported languages.

## 17. Future Enhancements

- Integration with hospital registration and electronic health record systems.
- Bed and room availability tracking.
- Nurse handoff and shift-change summaries.
- Waiting-time estimates that are carefully phrased and policy-approved.
- Translation support for more languages.
- Accessibility testing with patients and staff.
- Offline or limited-connectivity support.
- Staff collaboration and escalation workflows.
- Reporting on queue bottlenecks and recurring delays.
- Automated reminders for periodic patient condition checks.

## 18. Product Summary

The ER Triage Queue App gives patients a simple way to communicate their current condition and gives triage nurses a real-time, organized view of who may need attention first. Its core value is the combination of accessible intake, voice support, dynamic queue updates, and nurse-controlled prioritization.

The most important design principle is that the app should reduce communication friction without hiding clinical responsibility. Patients should always have a clear way to ask for help, and nurses should always be able to review, correct, and override the system’s recommendation.

## 19. Kiro Implementation Brief

This section is intended to be given directly to Kiro as the implementation direction for the hackathon application.

### Build objective

Build a professional, responsive ER triage queue web application for a hackathon demonstration. The application must support two user experiences:

1. A patient intake experience that supports language selection, typed answers, voice-based answers through Amazon Lex, and condition updates.
2. A triage nurse dashboard that displays a live priority queue, patient details, queue changes, and notifications.

The application should be functional with demo data and should be designed so AWS services can be connected through environment variables and clearly separated service modules.

### Implementation priorities

Implement the following in order:

1. Establish the application shell, routing, responsive layout, and shared design system.
2. Build the patient language-selection and intake flow.
3. Build patient condition updates.
4. Build the nurse queue dashboard.
5. Add queue recalculation and nurse notifications.
6. Add Amazon Lex integration behind a service abstraction.
7. Add persistence and deployment configuration.
8. Add validation, error handling, loading states, and demo seed data.

### Required screens

#### Patient screens

- Welcome/language selection screen.
- Session-code screen.
- Intake question screen.
- Answer confirmation screen.
- Intake submitted/status screen.
- Condition update screen.
- Help/emergency instruction modal or screen.

#### Nurse screens

- Nurse sign-in screen or demo nurse entry screen.
- Queue dashboard.
- Patient detail panel or page.
- Notification panel.
- Priority confirmation/override controls.
- Patient status action controls.

### Required patient flow

The patient flow must work as follows:

1. Display the app name and a short explanation of its purpose.
2. Allow the patient to select a language by clicking a button.
3. Include a visible voice-input option for language selection and intake.
4. Ask for a session code rather than requiring account creation.
5. Ask the patient a short sequence of plain-language questions.
6. Allow answers through buttons, text, or voice where appropriate.
7. Show a summary of the collected answers before submission.
8. Allow the patient to edit answers before submitting.
9. Submit the patient to the nurse queue.
10. Display a simple status page with a prominent condition-update action.
11. Allow the patient to report that symptoms are worse, better, changed, or require immediate help.
12. For immediate-help selections, tell the patient to notify nearby ER staff immediately. Do not rely only on an automated notification.

### Required nurse flow

The nurse flow must work as follows:

1. Open the nurse dashboard.
2. View all waiting patients in priority order.
3. See each patient’s current priority, complaint, severity, waiting time, trend, and last update time.
4. Clearly identify new patients and patients whose condition has changed.
5. Select a patient to view the intake summary and update timeline.
6. See why the system recommended the patient’s current priority.
7. Confirm the recommendation or override it.
8. Mark the patient as called, being seen, completed, unavailable, or requiring recheck.
9. Receive a visible notification when a patient’s priority increases or immediate help is requested.
10. See the queue update without manually refreshing the page when possible.

### Demo priority rules

Use transparent demo rules rather than an opaque medical model. The implementation should place the rules in a separate, easy-to-edit module.

Suggested demonstration behavior:

- Immediate-help request: Immediate review.
- Reported severe breathing difficulty, severe chest discomfort, fainting, confusion, or severe bleeding: Immediate review.
- Worsening symptoms plus high severity: Very urgent.
- High severity without a critical warning sign: Urgent.
- Moderate severity or stable symptoms: Standard.
- Low severity and improving symptoms: Low urgency.
- Use waiting time as a tie-breaker, not as a reason to delay a patient with a critical warning sign.

Every recommendation should include a human-readable reason, such as `Priority increased because the patient reported worsening symptoms and severe pain.`

The UI must label these as system recommendations. The nurse must be able to override them.

### Suggested frontend behavior

- Use a clean hospital-inspired visual design.
- Use large touch-friendly controls for patient screens.
- Use high contrast and do not communicate severity by color alone.
- Use responsive layouts for tablets, laptops, and desktop displays.
- Use cards, badges, icons, and clear status labels.
- Include loading, empty, error, and success states.
- Preserve the patient’s progress if they navigate backward.
- Confirm destructive or consequential nurse actions.
- Avoid unnecessary popups and repeated confirmation steps.

### Suggested data interfaces

Create typed interfaces or equivalent schemas for:

```text
PatientSession
- id
- sessionCode
- preferredLanguage
- status
- createdAt
- updatedAt
- currentPriority
- recommendedPriority
- priorityReason
- symptomTrend
- lastUpdateAt

IntakeResponse
- id
- sessionId
- questionId
- answer
- inputMethod
- transcriptConfidence
- createdAt

ConditionUpdate
- id
- sessionId
- trend
- severity
- description
- warningSigns
- createdAt
- previousPriority
- recommendedPriority
- priorityReason

QueueEntry
- sessionId
- position
- priority
- priorityReason
- status
- waitingSince
- lastUpdatedAt
- needsNurseReview

Notification
- id
- sessionId
- type
- message
- severity
- acknowledged
- createdAt
```

### Suggested API operations

Implement the backend behind a service layer so the frontend is not tightly coupled to mock data. The initial implementation may use local or in-memory demo persistence, but the interfaces should be ready for AWS persistence.

Suggested operations:

- `POST /api/sessions` — create a patient session.
- `GET /api/sessions/:id` — retrieve a patient session.
- `POST /api/sessions/:id/intake` — submit intake responses.
- `POST /api/sessions/:id/updates` — submit a condition update.
- `GET /api/queue` — retrieve the current nurse queue.
- `GET /api/queue/:sessionId` — retrieve one queue entry.
- `POST /api/queue/:sessionId/confirm` — confirm a recommendation.
- `POST /api/queue/:sessionId/override` — override a priority.
- `POST /api/queue/:sessionId/status` — change patient status.
- `GET /api/notifications` — retrieve nurse notifications.
- `POST /api/notifications/:id/acknowledge` — acknowledge a notification.

### Amazon Lex integration

Create an `AmazonLexService` or equivalent abstraction with methods similar to:

```text
startConversation(language, sessionId)
sendPatientMessage(sessionId, message)
getNextQuestion(sessionId)
endConversation(sessionId)
```

The app must remain usable if Amazon Lex credentials are not configured. In that case, show a clear demo-mode message and allow the patient to continue with typed input. Never expose AWS credentials in frontend code.

### Amazon Bedrock integration

Kiro should implement Bedrock as an optional backend service for AI-assisted processing. Use it to summarize free-text patient descriptions, extract structured symptoms, identify missing information, and explain changes to the recommended priority. Bedrock should not be used as an autonomous diagnostic or final triage system.

The backend should validate Bedrock output against a fixed schema before using it. Store both the original patient response and the generated summary. If Bedrock is unavailable, the app must continue working with raw responses and the deterministic queue rules. Include mock Bedrock responses for local demo mode so the full user experience can be demonstrated without cloud credentials.

The README must document the Bedrock model configuration, AWS region, required IAM permissions, environment variables, and how to enable or disable the integration.

Use environment variables for AWS configuration. Provide an `.env.example` file documenting required variables without including real secrets.

### Demo mode

Include a demo mode so the app can be presented reliably during the hackathon:

- Seed several patients with different priorities.
- Include at least one patient whose condition worsens during the demo.
- Include sample notifications.
- Provide a clearly labeled way to reset demo data.
- Make it possible to open the patient and nurse experiences in separate browser tabs.
- Keep demo mode separate from production data paths.

### Security and privacy requirements

- Never commit AWS credentials, API keys, or patient secrets.
- Validate all user input on the client and server.
- Use fake patient names or session identifiers in demo data.
- Avoid exposing full patient details in browser URLs when possible.
- Enforce nurse-only actions on the backend when authentication is implemented.
- Log priority changes and nurse overrides.
- Add a visible prototype disclaimer that the app is not a diagnostic system.

### Acceptance criteria

The MVP is complete when:

- A user can select a language and complete an intake flow.
- A user can complete the same flow by typing if voice services are unavailable.
- A submitted patient appears in the nurse queue.
- The queue is sorted using the configured priority rules.
- A patient can submit a condition update.
- A worsening or urgent update changes the recommended priority.
- The nurse dashboard shows a notification for the change.
- The nurse can view the patient’s details and update timeline.
- The nurse can confirm or override the recommendation.
- The patient can see a simple status page after intake.
- The app works on a tablet-sized viewport and a desktop viewport.
- The app includes loading, error, empty, and success states.
- The app runs with demo data even when AWS services are not configured.
- Setup and run instructions are documented in `README.md`.

### Expected project documentation

Kiro should create or update:

- `README.md` with installation, environment variables, local development, demo instructions, and AWS setup.
- `.env.example` with placeholder configuration names.
- An architecture section describing frontend, backend, queue logic, notifications, persistence, and Amazon Lex.
- A testing section describing how to test patient intake, queue changes, notifications, and nurse overrides.
- A known limitations section stating that this is a hackathon prototype and not a medical diagnostic tool.

### Recommended implementation approach

Start with a complete end-to-end demo using mock persistence and deterministic queue rules. Once the patient-to-nurse workflow works, add Amazon Lex and AWS persistence through isolated service modules. This keeps the core demonstration functional even if cloud credentials, network access, or speech recognition are unavailable during development.
