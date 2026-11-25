# South Africa: POPIA, VAT and municipal procurement obligations for MOTION (position as at 25 November 2026)

Scope: South African obligations for a workshop and fleet SaaS (MOTION) whose customers are SA workshops (private bodies) and municipalities (public bodies). MOTION processes customers' and vehicle owners' personal information and staff data: names, pay numbers, clocked time, signatures on job cards and requisitions, and job assignments. It sends notifications to named staff and is hosted outside SA (Namibia or a cloud region) with encrypted off-site backups.

Source quality note: primary sources were read for the 2023 MFMA SCM amendment gazette, the Information Regulator's 7 April 2025 media statement, the Regulator's Guidance Note on Information Officers, SARS's VAT and tax-invoice pages, and POPIA section text (via popia.co.za, a mirror of the Act). Other points rest on law-firm or consultancy commentary and are flagged as such.

---

## 1. POPIA roles: when is MOTION an "operator" and the customer the "responsible party", and what do sections 20 and 21 require?

### Takeaway
For data that its customers load and control (their customers, vehicle owners, their own staff), MOTION is an **operator**: it processes for the responsible party "in terms of a contract or mandate". The workshop or municipality is the **responsible party**. Section 20 binds MOTION to process only with the customer's knowledge or authorisation and to keep the data confidential. Section 21 requires the customer to have a **written contract** that makes MOTION establish and maintain section 19 security measures, and it obliges MOTION to notify the customer **immediately** of any suspected unauthorised access.

### Cited Findings
- **Operator** (s1): "a person who processes personal information for a responsible party in terms of a contract or mandate" [the full statutory definition continues "without coming under the direct authority of that party"; the fetched excerpt was truncated]. — [POPIA s1 (popia.co.za)](https://popia.co.za/section-1-definitions/)
- **Responsible party** (s1): a "public or private body or any other person which, alone or in conjunction with others, determines the purpose of and means for processing personal information". — [POPIA s1 (popia.co.za)](https://popia.co.za/section-1-definitions/); same wording in [Information Regulator, Guidance Note on Information Officers, para 1.11](https://inforegulator.org.za/wp-content/uploads/2025/07/Guidance_Note_on_Information_Officers_.pdf)
- **Section 20** (information processed by operator or person acting under authority): an operator, or anyone processing personal information for a responsible party or an operator, must (a) "process such information only with the knowledge or authorisation of the responsible party", and (b) treat the personal information as confidential and not disclose it, "unless required by law or in the course of the proper performance of their duties". — [POPIA s20 (popia.co.za)](https://popia.co.za/section-20-information-processed-by-operator-or-person-acting-under-authority/)
- **Section 21(1)**: a responsible party must, "in terms of a written contract between the responsible party and the operator", ensure that the operator establishes and maintains the security measures referred to in **section 19**. — [POPIA s21 (popia.co.za)](https://popia.co.za/section-21-security-measures-regarding-information-processed-by-operator/)
- **Section 21(2)**: "The operator must notify the responsible party immediately where there are reasonable grounds to believe" that personal information "has been accessed or acquired by any unauthorised person". — [POPIA s21 (popia.co.za)](https://popia.co.za/section-21-security-measures-regarding-information-processed-by-operator/)
- A municipality is a "public body" (any municipality in the local sphere of government). Its Information Officer is the **Municipal Manager** or the person acting as such. For a private juristic person (such as a workshop company) it is the CEO or MD or equivalent, or a person they authorise. — [Information Regulator, Guidance Note on Information Officers (1 April 2021), paras 1.9 and 5.1](https://inforegulator.org.za/wp-content/uploads/2025/07/Guidance_Note_on_Information_Officers_.pdf)
- Practitioner commentary: the section 21 operator agreement is the usual place to record the section 72 cross-border basis. A data processing agreement that is silent on hosting location does not satisfy section 72, even if it meets section 21. GDPR-drafted addenda should be checked for POPIA-specific terms. (Consultancy and secondary sources, not the Regulator.) — [GrowthPulse Media, POPIA operator agreement (2026)](https://www.growthpulsemedia.co.za/popia-operator-agreement-south-africa/); [MJK Inc, cross-border transfer agreement](https://mjkinc.co.za/agreements/cross-border-data-transfer-agreement)
- Where a compromise occurs at an operator, the responsible party still makes the section 22 notification to the Regulator and data subjects (secondary commentary). — [MJK Inc, POPIA data breaches](https://mjkinc.co.za/popia/data-breaches); [Loophold, POPIA breach notification for MSPs](https://www.loophold.com/news/popia-breach-notification-for-msps-what-section-22-requires-when-a-client-is-hit/)

### Inferences
- MOTION is likely an **operator** for: workshop and municipal customer records, vehicle owners' details, the customer's employees' names, pay numbers, clocked time, signatures and job assignments, and the notifications it sends to named staff on the customer's instruction. The customer decides why those records exist (running its workshop or fleet), and MOTION processes them under the subscription contract.
- MOTION is likely a **responsible party** in its own right for: its own account and billing contacts at customers, its own employees, its marketing lists, and any analytics or product use of customer data beyond the customer's instructions. Going beyond instructions would also breach section 20(a) and could make MOTION a responsible party for that processing.
- The operator agreement (DPA) should, at minimum: (1) limit processing to documented instructions (s20(a)); (2) bind MOTION staff and sub-processors to confidentiality (s20(b)); (3) commit MOTION to establish and maintain section 19 security measures (s21(1)); (4) require immediate notice of suspected compromise (s21(2)), with practical content and a contact path so the customer can meet its own section 22 duty; (5) name hosting and backup locations and the section 72 basis (see Q4); (6) control sub-processors and onward transfers. Items 5 and 6 come from practitioner guidance rather than the statute's text.
- Section 19 (not re-fetched in this session) requires appropriate, reasonable technical and organisational measures against loss, damage, unauthorised destruction and unlawful access. It also requires identifying risks, establishing and verifying safeguards, and having due regard to generally accepted information security practices. Verify the exact wording before quoting it in documents.

### Gaps
- The full text of section 19 and the complete section 1 "operator" definition were not fetched verbatim in this session. Use the Government Gazette text of the Act for exact quotations.
- No Information Regulator guidance note specifically on operators, SaaS or cloud providers was found.

---

## 2. Security compromise notification (section 22): current process, form, in force since when, timing

### Takeaway
Since **1 April 2025**, responsible parties must report security compromises to the Information Regulator through the **eServices portal** (eservices.inforegulator.org.za/compromises), not by email. The Regulator announced this on 7 April 2025. Section 22 has no fixed hour deadline: notice is due "as soon as reasonably possible" after discovery. Data subjects must be notified in writing as well. The operator (MOTION) notifies the customer "immediately" under section 21(2), and the customer, as responsible party, notifies the Regulator and data subjects.

### Cited Findings
- Regulator media statement, **7 April 2025**: the Security Compromises Reporting functionality on the eServices portal "as of 01 April 2025, is mandatory for all organisations to report any security compromises using the portal, rather than via email". Direct URL: https://eservices.inforegulator.org.za/compromises/default.aspx. The Regulator also published a step-by-step guide to registering Information Officers and submitting reports through the portal. — [Information Regulator media statement, 7 April 2025](https://inforegulator.org.za/wp-content/uploads/2025/04/MEDIA-STATEMENT-INVITATION-TO-REPORT-SECURITY-COMPROMISES-THROUGH-THE-eSERVICES-PORTAL-.pdf)
- **s22(1)**: where there are reasonable grounds to believe personal information has been "accessed or acquired by any unauthorised person", the responsible party must notify the Regulator and, subject to s22(3), the data subject, unless the data subject's identity cannot be established. — [POPIA s22 (popia.co.za)](https://popia.co.za/section-22-notification-of-security-compromises/)
- **s22(2) timing**: "as soon as reasonably possible" after discovery, taking into account the legitimate needs of law enforcement and any measures reasonably necessary to determine the scope of the compromise and restore the integrity of the information system. — [POPIA s22](https://popia.co.za/section-22-notification-of-security-compromises/)
- **s22(3)**: notice to data subjects may be delayed only if a public body responsible for preventing, detecting or investigating offences, or the Regulator, determines that notification would impede a criminal investigation. — [POPIA s22](https://popia.co.za/section-22-notification-of-security-compromises/)
- **s22(4) manner**: notice to the data subject must be in writing, by at least one of: mail to the last known physical or postal address; email to the last known email address; prominent placement on the responsible party's website; publication in news media; or as the Regulator directs. — [POPIA s22](https://popia.co.za/section-22-notification-of-security-compromises/)
- **s22(5) content**: enough information for the data subject to take protective measures, including: the possible consequences; the measures the responsible party intends to take or has taken; recommended mitigating steps for the data subject; and the identity of the unauthorised person, if known. — [POPIA s22](https://popia.co.za/section-22-notification-of-security-compromises/)
- **s22(6)**: the Regulator may direct a responsible party to publicise a compromise if it has reasonable grounds to believe publicity would protect affected data subjects. — [POPIA s22](https://popia.co.za/section-22-notification-of-security-compromises/)
- Secondary commentary reports that the portal form asks for: a description of the compromise, the categories and volume of information, likely consequences, measures taken, recommendations to data subjects, and Information Officer contact details. It also reports the Regulator's position (in an August 2025 fact sheet, not retrieved here) that POPIA has **no harm threshold** for reporting. — [Elyforma, eServices guide](https://www.elyforma.com/blog/popia-security-compromise-notification-guide); [MJK Inc](https://mjkinc.co.za/popia/data-breaches)
- A "72-hour" deadline cited by some vendor guides **could not be confirmed**. The statute says "as soon as reasonably possible". — [POPIA s22](https://popia.co.za/section-22-notification-of-security-compromises/)
- Scale and enforcement context, from the Regulator's 31 August 2026 media briefing as reported 4 September 2026 (secondary):
  - more than 8,000 security compromise notifications since commencement;
  - more than 1,220 since 1 April 2026, with about 3,000 projected for the 2026/27 financial year;
  - leading causes: inadequate security controls, employee negligence, weak passwords, malware or ransomware, and phishing;
  - Blouberg Local Municipality was fined R500,000, reduced by a court to R250,000;
  - the Chairperson stated that a responsible party that complies within the period set in an enforcement notice "can no longer be fined".
  — [ITLawCo, Information Regulator briefing 2026](https://itlawco.com/information-regulator-briefing-2026/)

### Inferences
- MOTION's incident procedure should treat section 21(2) "immediately" as the governing clock for operator-to-customer notice (hours, not days). It should supply what the customer needs for the portal form: description, categories and volumes, likely consequences, containment steps and recommendations.
- Because the responsible party (the workshop or municipality) files on the portal and needs a registered Information Officer to do so, MOTION's documents should not say that MOTION "reports to the Regulator" for customer data. MOTION would report on the portal only for data where it is itself the responsible party, such as its own staff and billing contacts.
- Municipal customers have already been fined by the Regulator (Blouberg), so municipal buyers are likely to ask about breach handling in procurement.

### Gaps
- The Regulator's August 2025 fact sheet ("no threshold") and the current portal field list were not retrieved directly.
- No Regulator-published expected turnaround (for example "within X days") was found; the statute remains "as soon as reasonably possible".

---

## 3. Information Officer registration (and 2025–2026 changes); direct marketing (section 69)

### Takeaway
Every responsible party must register its Information Officer (IO) with the Regulator before the IO takes up duties (s55(2)), via the eServices portal. For municipalities the IO is the Municipal Manager; for companies it is the CEO or MD, or an authorised manager. No change to registration rules was found for 2025–2026.

The amended POPIA Regulations published **17 April 2025** changed related duties:
- They **removed the PAIA-manual duty from regulation 4**.
- They kept the compliance framework duty, now with "continually improved".
- They require free, multi-channel objection, correction and consent processes. Forms need only be "substantially similar" to the prescribed forms.
- They state that **opt-out is not consent** for electronic direct marketing.

On direct marketing, the Regulator treats **telephone calls** as electronic communications under section 69. Industry disputes this, and the Regulator is seeking a court ruling. Consumer Protection Act regulations gazetted 15 April 2026 add a national opt-out registry, which does not replace POPIA consent.

### Cited Findings
**Information Officer registration**
- IOs and Deputy IOs "are required, in terms of Section 55(2) of POPIA, to take up their duties only after being registered with the Regulator". Registration is compulsory, and the responsible party must ensure its IO is registered. — [Guidance Note on Information Officers, paras 2.3, 6.6, 6.8](https://inforegulator.org.za/wp-content/uploads/2025/07/Guidance_Note_on_Information_Officers_.pdf)
- Who the IO is: for a municipality, the Municipal Manager or the person acting as such; for a juristic person, the CEO or MD or equivalent, or a person they authorise in writing. An authorised IO should be at management level or above. — [Guidance Note, paras 5.1, 5.5, 5.9](https://inforegulator.org.za/wp-content/uploads/2025/07/Guidance_Note_on_Information_Officers_.pdf)
- A multinational entity based outside the Republic must authorise a person **within South Africa** as IO, and must designate a Deputy IO based in SA. Only employees can be Deputy IOs. Each subsidiary in a group must register its own IO. — [Guidance Note, paras 5.2, 5.3, 7.2, 7.6, 7.13](https://inforegulator.org.za/wp-content/uploads/2025/07/Guidance_Note_on_Information_Officers_.pdf)
- Registration is by online form (eServices) or the Annexure A form. Particulars must be updated at intervals of not more than one year, and must match the PAIA manual. — [Guidance Note, paras 10.1, 11.1, 11.2](https://inforegulator.org.za/wp-content/uploads/2025/07/Guidance_Note_on_Information_Officers_.pdf)
- The Guidance Note in the Regulator's 2025 upload is still the **1 April 2021** version; no revised IO guidance note was found. — [Guidance Note (dated 1 April 2021)](https://inforegulator.org.za/wp-content/uploads/2025/07/Guidance_Note_on_Information_Officers_.pdf)
- A September 2026 briefing summary says registration is "not optional, and it is the first thing an assessment looks for". It reports **no** new registration rule, POPIA amendment bill or new guidance note in 2025–2026. — [ITLawCo, 4 Sept 2026](https://itlawco.com/information-regulator-briefing-2026/)

**Amended POPIA Regulations (published 17 April 2025, with immediate effect)**
- Regulation 4 (IO duties): the duty to develop, maintain and make available a PAIA manual was deleted from regulation 4. IOs must still ensure that "a compliance framework is developed", implemented, monitored, maintained and continually improved. — [Baker McKenzie, 8 May 2025](https://connectontech.bakermckenzie.com/south-africa-amendments-to-the-popia-regulations-key-changes-you-need-to-know/)
- Regulation 2 (objections, Form 1) and regulation 3 (correction or deletion, Form 2): forms need only be "substantially similar". Requests are free and may be made by hand, fax, post, email, SMS, WhatsApp or any expedient manner. Telephonic objections must be electronically recorded and made available free on request. Responsible parties must tell data subjects about the right to object at collection, and must notify them once a correction or deletion is done. — [Baker McKenzie, 8 May 2025](https://connectontech.bakermckenzie.com/south-africa-amendments-to-the-popia-regulations-key-changes-you-need-to-know/)
- Regulation 6 (direct marketing consent, Form 4): consent may be sought on a form "substantially similar to Form 4" or in any expedient manner, free of charge. Telephonic or automated-call consent requests must be recorded. "Opt-out" shall not constitute consent. — [Baker McKenzie, 8 May 2025](https://connectontech.bakermckenzie.com/south-africa-amendments-to-the-popia-regulations-key-changes-you-need-to-know/). Bowmans reads it the same way; Novation Consulting reads it more strictly (as requiring a Form 4-like form), as reported in search summaries — [Bowmans](https://bowmanslaw.com/insights/south-africa-popia-regulations-get-a-makeover-what-you-need-to-know/); [Novation, 30 June 2025](https://novcon.co.za/2025/06/30/updated-popia-regulations/)
- Regulation 7 (complaints): broader standing to complain, and the Regulator must issue a reference number within 14 days. Regulation 13: fines may be paid in instalments. — [Baker McKenzie](https://connectontech.bakermckenzie.com/south-africa-amendments-to-the-popia-regulations-key-changes-you-need-to-know/)

**Direct marketing (section 69)**
- Definitions: "direct marketing" means to approach a data subject "in person or by mail or electronic communication" to promote or offer goods or services (or request donations). "Electronic communication" means "any text, voice, sound or image message sent over an electronic communications network". — [POPIA s1](https://popia.co.za/section-1-definitions/)
- The Regulator's Guidance Note on Direct Marketing (secondary sources date it 3 December 2024; the PDF sits under a 2020 upload path) gives a non-exhaustive list of electronic direct marketing that **includes telephone**. Under that reading, telemarketing needs prior consent unless the customer exception in s69(3) applies. — [Regulator Guidance Note on Direct Marketing](https://inforegulator.org.za/wp-content/uploads/2020/07/GUIDANCE-NOTE-ON-DIRECT-MARKETING-IN-TERMS-OF-THE-PROTECTION-OF-PERSONAL-INFORMATION-ACT-4-OF-2013-POPIA.pdf); [Lexology summary](https://www.lexology.com/library/detail.aspx?g=4c081e86-a3c6-4898-95f9-482ac5a45964); [MJK Inc, direct marketing](https://mjkinc.co.za/popia/direct-marketing)
- Dispute: the sector argues that voice calls fall outside section 69. OUTsurance and MTN were referred to the Enforcement Committee, and the Regulator expects a court to decide. A R100,000 direct-marketing fine (FT Rams Consulting) was being processed. About 10% of more than 3,800 complaints in the prior year concerned direct marketing. — [ITLawCo, 4 Sept 2026](https://itlawco.com/information-regulator-briefing-2026/)
- CPA amendment regulations gazetted **15 April 2026** introduced a national opt-out (block) registry. The Regulator says registering on it does not displace the POPIA obligation to obtain consent before unsolicited electronic direct marketing. — [Information Regulator media statement on CPA Amendment Regulations 2026](https://inforegulator.org.za/wp-content/uploads/2026/04/MEDIA-STATEMENT-REGULATOR-NOTES-PUBLISHED-GAZETTE-OF-THE-CONSUMER-PROTECT-ACT-AMENDMENT-REGULATIONS-2026.pdf) (via search summary); [ITLawCo](https://itlawco.com/information-regulator-briefing-2026/)

### Inferences
- MOTION itself, as a South African-facing private body, needs its own registered IO if it processes personal information as a responsible party. If MOTION is incorporated outside SA (for example in Namibia), the Guidance Note requires a person **in SA** to be authorised as IO, and an SA-based Deputy IO. Secondary reporting says the portal may not accept a non-SA appointee.
- Each workshop customer and each municipality must have its own registered IO. MOTION's documents can point customers to this, but cannot do it for them.
- Workflow messages to named staff (job assigned, requisition awaiting approval) are not "direct marketing" because they promote no goods or services. **Service-due reminders or promotions sent to vehicle owners** are likely direct marketing. By SMS, email or WhatsApp these need consent (Form 4-like, opt-in) or the s69(3) existing-customer exception. If MOTION offers marketing features, it should record consent per channel, offer a free opt-out in every message, and keep recordings where consent is obtained by phone.
- Data-subject request handling must accept requests through any channel, free of charge. A MOTION feature that exports or corrects a person's records helps the customer comply.

### Gaps
- The text of s69(1)–(4) was not fetched verbatim this session. Commonly stated content: consent or existing-customer exception; one approach to seek consent; an opt-out in each message; sender identity and contact details. Confirm against the Act.
- No 2025–2026 change to IO registration fees, renewal or form was found. "Not more than one year" updating applies.
- The exact gazette number of the 17 April 2025 amended Regulations was not captured.

---

## 4. Cross-border transfers (section 72) for a SaaS hosted outside SA, and employee monitoring / time-tracking

### Takeaway
Hosting customer data in Namibia or a non-SA cloud region (including off-site backups) should be treated as a **transfer to a third party in a foreign country**. Under section 72 the responsible party (the customer) needs one of five grounds. For B2B SaaS, the practical ground is s72(1)(a): the recipient is bound by a law, binding corporate rules or a **binding agreement** giving adequate protection, including onward-transfer restrictions. Namibia had **no comprehensive data protection law in force** on the latest evidence (mid-2026), so the "law" limb cannot be relied on for Namibia and the contract must do the work. **Special personal information** (including biometric data) or children's information sent to a country without adequate protection needs the Regulator's **prior authorisation** (s57(1)(d)).

For staff data, clocked time and pay records are needed to meet the employer's own BCEA record duty: three years from the last entry. Biometric clocking is special personal information under sections 26–27 and 33.

### Cited Findings
**Section 72**
- s72(1): a responsible party in SA may not transfer personal information to a third party in a foreign country unless one of these applies:
  - (a) the recipient is subject to a law, binding corporate rules or a binding agreement that provides an adequate level of protection, effectively upholding principles substantially similar to POPIA's conditions, and includes provisions on onward transfer that are substantially similar;
  - (b) the data subject consents;
  - (c) the transfer is necessary to perform a contract with the data subject, or for pre-contractual measures the data subject requested;
  - (d) the transfer is necessary for a contract in the data subject's interest between the responsible party and a third party;
  - (e) the transfer is for the data subject's benefit, consent is not reasonably practicable, and the data subject would likely give it.
  s72(2) defines "binding corporate rules" and "group of undertakings". — [POPIA s72 (popia.co.za)](https://popia.co.za/section-72-transfers-of-personal-information-outside-republic/)
- **Prior authorisation**: the responsible party must obtain the Regulator's prior authorisation to transfer "special personal information or the personal information of children to a third party in a foreign country that does not provide an adequate level of protection" (s57(1)(d), read with s72). Processing is suspended pending authorisation, and failure to notify is an offence (fine or up to 12 months' imprisonment). — [Guidance Note on Information Officers, paras 6.1.3.1(d)–6.1.3.3](https://inforegulator.org.za/wp-content/uploads/2025/07/Guidance_Note_on_Information_Officers_.pdf)
- The Regulator has launched online prior-authorisation and exemption applications (no date given). — [ITLawCo, 4 Sept 2026](https://itlawco.com/information-regulator-briefing-2026/)
- Commentary on storage as transfer: hosting personal information on offshore servers, or giving offshore staff access, is treated as a cross-border transfer. Access and storage activities "may be considered as data transfers". No SA adequacy list has been published, so each transfer needs its own assessment. (Secondary.) — [CMS, Managing cross-border data transfers](https://cms.law/en/zaf/legal-updates/Managing-cross-border-data-transfers); [Kevin Bishop Consulting](https://kevinbishop.co.za/blog-personal-information-outside-south-africa.html)
- **Contrary academic view**: Coetzee (2024, PER 48) reportedly argues that section 72 does not provide for transfers by operators, and that the duty rests on the exporting responsible party. This is from a search summary; the article was not retrieved (HTTP 403). — [Coetzee, "Cross-Border Data Flows and POPIA – Part II" (2024) PER 48](https://www.saflii.org/za/journals/PER/2024/48.html)
- **Namibia**: no comprehensive data protection law as of May 2026. Sources conflict on whether the Data Protection Bill was tabled in October 2025 or was still awaiting the Cabinet Committee on Legislation in January 2026. Promulgation is "expected" by end-2026, but no passage was confirmed. — [Chambers Doing Business In 2026 (Namibia)](https://gpg-pdf.chambers.com/Doing-Business-In-2026/718/); [CGTN, 27 Jan 2026](https://newsaf.cgtn.com/news/2026-01-27/Namibia-moves-to-fast-track-cybercrime-laws-amid-digital-expansion-1Kh6jgZapuo/share_amp.html); [The Namibian](https://www.namibian.com.na/govt-to-introduce-data-protection-bill-in-september/)

**Employee data, monitoring and time-tracking**
- Personal information expressly includes employment history, identifying numbers, location information and biometric information. — [Guidance Note on IOs, para 1.6 (quoting POPIA s1)](https://inforegulator.org.za/wp-content/uploads/2025/07/Guidance_Note_on_Information_Officers_.pdf)
- "Biometrics" is defined as a technique of personal identification based on physical, physiological or behavioural characterisation. Special personal information is defined by reference to s26. Section 33 is headed "Authorisation concerning data subject's criminal behaviour or biometric information", and section 30 covers trade union membership. — [POPIA s1](https://popia.co.za/section-1-definitions/); [POPIA s27 page navigation](https://popia.co.za/section-27-general-authorisation-concerning-special-personal-information/)
- s27(1) lifts the prohibition on processing special personal information where, among other grounds, there is **consent** or the processing is necessary to **establish, exercise or defend a right or obligation in law**. — [POPIA s27](https://popia.co.za/section-27-general-authorisation-concerning-special-personal-information/)
- BCEA s31: every employer must keep a record of each employee's name and occupation, **time worked**, remuneration paid, date of birth (if under 18) and other prescribed information. It must be kept for **three years from the date of the last entry**, and false entries are prohibited. The duty reportedly does not apply to employers with fewer than five employees (per the search summary of the BCEA small-employer exclusion). — [BCEA s31 (acts.co.za)](https://source.acts.co.za/basic-conditions-of-employment-act-1997/bcoe97_31__keeping_of_records.php)
- Biometric clocking: secondary sources agree it is lawful but is special personal information, and they disagree on whether consent is required. The Regulator "has not issued a definitive ruling on workplace biometrics", and consent in employment is considered weak. Sources recommend a non-biometric alternative (PIN or card) and purpose limitation. — [Meyer Attorneys, 14 Nov 2025](https://meyerattorneys.co.za/2025/11/14/biometric-timekeeping-law/); [POPIA Ready](https://www.popiaready.co.za/blog/is-biometric-clocking-legal-south-africa)

### Inferences
- MOTION's DPA with SA customers should carry a **POPIA-specific s72(1)(a) clause**: named hosting and backup countries or regions; commitments substantially similar to POPIA's conditions; a sub-processor and onward-transfer restriction; and audit or assurance rights. Hosting in Namibia (no data protection statute yet) makes the contractual limb essential. A cloud region in a country with its own data protection law may also support the "law" limb, but each country needs its own assessment.
- Encrypted off-site backups are still storage abroad and should be named in the DPA. Encryption reduces risk but is not a section 72 exemption; no source says it is.
- MOTION's described staff data (names, pay numbers, clocked time, signatures as images or strokes on job cards, job assignments) is ordinary personal information, not special personal information, unless MOTION adds fingerprint or face clocking or stores signature biometrics (pressure and timing dynamics). If biometric clocking is added and hosted outside SA without an adequate-protection basis, s57(1)(d) prior authorisation becomes relevant.
- Time records in MOTION support the customer-employer's BCEA s31 duty (three years from the last entry). Retention settings should not delete clocking data before that period ends for customers with five or more employees.
- Productivity analytics on mechanics (time against estimate) is processing for the employer's purposes. The customer as responsible party should give employees section 18 notice; MOTION can supply template wording.

### Gaps
- No Information Regulator guidance specifically on employee monitoring or workplace time-tracking was found.
- RICA (interception of communications) was not researched; it is likely irrelevant unless MOTION intercepts communications.
- The Coetzee PER article could not be retrieved, so the operator-transfer argument is reported second-hand.
- Whether any cloud region country has been treated by the Regulator as "adequate" is unknown; no adequacy list exists.

---

## 5. VAT in 2026: rate (was the 15.5% increase withdrawn?) and tax invoice requirements

### Takeaway
The standard VAT rate is **15%**. The 2025 Budget proposals (15.5% from 1 May 2025, 16% from 1 April 2026) were **reversed** by a Bill introduced on 24 April 2025, and the **25 February 2026 Budget left the rate at 15%**. From **1 April 2026** the compulsory VAT registration threshold rose from R1 million to **R2.3 million**, and the voluntary threshold from R50,000 to **R120,000**. Tax invoice rules are unchanged:
- full tax invoice where consideration exceeds **R5,000**;
- abridged invoice at R5,000 or less;
- no tax invoice needed at R50 or less (till slip suffices);
- issue within **21 days** of the supply.

### Cited Findings
- SARS: "VAT is levied at the standard rate of 15%". The rate "was to increase to 15.5% from 1 May 2025 and to 16% from 1 April 2026", but "this is reversed by clause 13 of the Bill introduced on 24 April 2025". — [SARS, Value-Added Tax page](https://www.sars.gov.za/types-of-tax/value-added-tax/)
- SARS (25 February 2026 entry): "The compulsory registration threshold is increased from R1 million to R2.3 million." "The voluntary registration threshold is increased from R50 000 to R120 000." "The effective date for the increase is 1 April 2026." — [SARS, Value-Added Tax page](https://www.sars.gov.za/types-of-tax/value-added-tax/)
- The 2026 Budget (25 February 2026) made no change to the VAT rate. — [Mondaq, 2026 Budget analysis – VAT](https://www.mondaq.com/southafrica/sales-taxes-vat-gst/1752652/2026-budget-analysis-and-commentary); [Grant Thornton, 2026 Budget highlights](https://www.grantthornton.co.za/insights2/2026-budget-speech-highlights/)
- Tax invoice contents, valid from 8 January 2016:
  - the words "Tax Invoice", "VAT Invoice" or "Invoice";
  - the supplier's name, address and VAT registration number;
  - the recipient's name and address, and the recipient's VAT number if the recipient is a vendor;
  - a serial number and date of issue;
  - an accurate description of the goods or services, indicating second-hand goods where applicable;
  - quantity or volume;
  - value of the supply, tax charged and consideration.
  A full tax invoice is required where consideration exceeds R5,000. An abridged invoice may be issued at R5,000 or less. No tax invoice is required at R50 or less, but a till slip or docket is needed to support input tax. Invoices must be issued within 21 days of the supply. (Page last updated 11 March 2021.) — [SARS, Tax Invoices](https://www.sars.gov.za/businesses-and-employers/tax-invoices/)
- Section 20(5): an abridged invoice need not contain the recipient's name, address or VAT number. Since 1 April 2015 SARS disallows input-tax claims where invoice requirements are not met in full. — [VAT Act s20 (acts.co.za)](https://www.acts.co.za/value-added-tax-act-1991/20__tax_invoices); [SARS letter on s20(4)](https://www.sars.gov.za/wp-content/uploads/Docs/Embassies/Sec-20-4-Letter-to-Diplomatic-missions.pdf)

### Inferences
- MOTION's SA invoice template, for vendor-registered workshops, should calculate tax at 15% from the document's own stored rate (consistent with MOTION's rule of taking tax from the document snapshot). It should switch to the full-invoice layout (recipient name, address and VAT number) when consideration exceeds R5,000, and enforce the 21-day issue rule.
- Municipalities are customers that commonly hold VAT registration, so invoices to them over R5,000 should carry the municipality's VAT number. (Inference; not verified per municipality.)
- The higher R2.3 million compulsory threshold from 1 April 2026 means more small workshops may be non-vendors. MOTION should allow "not VAT registered" workshops to issue plain invoices with no VAT and no "Tax Invoice" wording.

### Gaps
- No SARS e-invoicing mandate in force for 2026 was found or researched. Monitor National Treasury and SARS VAT modernisation proposals.
- The SARS Tax Invoices page date (2021) predates 2026, but no later change to section 20 invoice content was found.

---

## 6. Municipal Supply Chain Management Regulations (MFMA): thresholds for quotations and competitive bidding

### Takeaway
The commonly quoted figures (R2,000 / R10,000 / R30,000 / R200,000 and "verbal or written quotations") are **out of date**. The Minister of Finance amended the Municipal SCM Regulations by **Notice 4198, Government Gazette 49863, 14 December 2023**, effective on publication. The changes:
- the "written or verbal quotations" band was abolished;
- **formal written price quotations** now cover purchases over R2,000 up to **R300,000 (local municipality)**, **R200,000 (district municipality)** or **R750,000 (metro)**, VAT included;
- **competitive bidding** is required above those values.

Formal written price quotations still need **at least three written quotes** from accredited providers. If fewer than three are obtained, the reasons must be recorded and approved by the CFO or a designated official. Requirements **over R30,000** must still be **advertised for at least seven days** on the municipal website and an official notice board.

No further threshold changes were found for 2025–2026. The **Public Procurement Act 28 of 2024** had not commenced on the latest evidence (status checked 23 September 2026, article updated 25 November 2026), so the MFMA SCM regime still applies.

### Cited Findings
- Notice No. **4198**, Government Gazette No. **49863**, **14 December 2023**: "Amendments to Regulations regarding Supply Chain Management", made by the Minister of Finance with the concurrence of the Minister of Cooperative Governance and Traditional Affairs under MFMA s168(1). It amends GN 868 of 30 May 2005 (as amended by R.31 of 20 January 2017). "These Regulations take effect on the date of publication in the Gazette." — [National Treasury MFMA, gazette PDF](https://mfma.treasury.gov.za/RegulationsandGazettes/Municipal%20SCM%20Amendment%20Regulations.pdf); [gov.za copy](https://www.gov.za/sites/default/files/gcis_document/202312/49863gon4198.pdf)
- Changes made by the amendment — [Gazette 49863](https://mfma.treasury.gov.za/RegulationsandGazettes/Municipal%20SCM%20Amendment%20Regulations.pdf):
  - **Reg 1**: the definition of "written or verbal quotations" was deleted.
  - **Reg 12(1)**: paragraph (b) (written or verbal quotations) was deleted. The new (c) covers "formal written price quotations for procurement of a transaction value over—(i) R2000 up to R300 000 (VAT included), in the case of a local municipality; (ii) R2000 up to R200 000 (VAT included), in the case of a district municipality; (iii) R2000 up to R750 000 (VAT included), in the case of a metropolitan municipality". The new (d) requires competitive bidding above R300,000 (local), R200,000 (district) and R750,000 (metro), VAT included. Reg 12(2)(b)(iii) allows competitive bidding to be required below these thresholds.
  - **Reg 16** (written or verbal quotations procedure) was deleted.
  - **Reg 18** was retitled "Procedures for procuring goods or services through formal written price quotations". Paragraph (c) requires reasonable steps to prevent abuse. Paragraph (d) requires that the accounting officer or CFO be notified monthly in writing of all formal written price quotations accepted under a subdelegation.
  - **Reg 19** (substituted): goods or services above R300,000 (local), R200,000 (district) or R750,000 (metro), VAT included, may be procured only through competitive bidding, subject to reg 11(2). Requirements above those values may not be deliberately split into lesser parts to avoid competitive bidding.
  - **Reg 35**: consultancy services must be competitively bid if the value exceeds the same thresholds or the contract period exceeds one year.
- **Reg 17** (formal written price quotations): quotations "must be obtained in writing from at least three different providers whose names appear on the list of accredited prospective providers". Non-listed providers may be invited if they meet the reg 14(1)(b)–(c) listing criteria. If three quotations cannot be obtained, the reasons "must be recorded and approved by the chief financial officer" or a designated official, and approvals are reported to the CFO within three days after the end of each month. The accounting officer records the names of potential providers and their written quotations. — [MFMA SCM Regulations reg 17 (acts.co.za)](https://source.acts.co.za/municipal-finance-management-act-2003/n868_17__formal_written_price_.php)
- **Reg 18(a)**, unchanged by the 2023 notice: requirements in excess of **R30,000 (VAT included)** procured by formal written price quotations must, in addition to reg 17, be "advertised for at least seven days on the website and an official notice board" of the municipality or entity. Reg 18(b) requires rotation among accredited providers to promote ongoing competition; reg 18(e) requires proper record keeping. — [MFMA SCM Regulations reg 18 (acts.co.za, annotated with Notice 4198)](https://source.acts.co.za/municipal-finance-management-act-2003/n868_18__procedures_for_procur.php)
- Implementation varies: City of Johannesburg SCM Practice Note 01/2024 raised its threshold from R200,000 to R750,000 (VAT included) and deleted references to verbal quotations. Some 2025/26 municipal SCM policies (Sedibeng; Beaufort West) still show older bands such as R10,000–R200,000, so each municipality's adopted SCM policy must be checked. — [CoJ SCM Practice Note 01-2024](https://joburg.org.za/work_/Documents/SUPPLY%20CHAIN%20MANAGEMENT%20PRACTICE%20NOTE%2001-2024%20-AMENDMENTS_.pdf); [Sedibeng SCM Policy 2025-26](https://www.sedibeng.gov.za/a_keydocs/2025-2026%20MFMAs/Budget%20related%20policies%2032141/15.%20Supply%20Chain%20Management%20Policy%20and%20Procedures%20%20-%20(2025-26).pdf)
- Media coverage of the change: "New rules will allow South Africa's municipalities to spend more without needing tenders." — [BusinessTech](https://businesstech.co.za/news/government/441608/new-rules-will-allow-south-africas-municipalities-to-spend-more-without-needing-tenders/)
- **Public Procurement Act 28 of 2024** (assented 23 July 2024):
  - the government Act page lists commencement as "To be proclaimed", per a status check on 23 September 2026 (article updated 25 November 2026);
  - Treasury (August 2024) said it will commence by presidential proclamation, and the existing MFMA, PFMA and PPPFA framework stays in place until then;
  - one search-result source says draft General Public Procurement Regulations were published for comment on **16 April 2026** (not verified against Treasury).
  — [CivicLedger status note (23 Sept 2026, updated 25 Nov 2026)](https://www.civicledger.co.za/news/public-procurement-act-28-2024-commencement-status/); [National Treasury media statement, Aug 2024](https://www.treasury.gov.za/comm_media/press/2024/2024081301%20Media%20Statement%20-%20Commencement%20of%20Public%20Procurement%20Act.pdf); [gov.za Act page](https://www.gov.za/documents/acts/public-procurement-act-28-2024-english-setswana-23-jul-2024)

### Inferences
- MOTION's purchase-requisition rules for SA municipal tenants should be configurable by **municipality category** (local, district, metro), with defaults from the 2023 regulations:
  - **up to R2,000**: petty cash band (reg 12(1)(a), not amended; the new bands start "over R2000");
  - **over R2,000 up to the category threshold**: at least **3 written quotes** from the accredited supplier list, or recorded reasons plus CFO or designated-official approval when fewer than 3;
  - **over R30,000**: also a 7-day advert on the website and notice board (an "advertised" flag or date on the requisition);
  - **above the category threshold**: competitive bid, outside MOTION's quote flow.
  MOTION should also give a split-purchase warning (reg 19(b)) and produce a monthly report of quotations accepted under subdelegation for the accounting officer or CFO (reg 18(d)).
- Each municipality's own adopted SCM policy may set lower thresholds (reg 12(2)(b)(iii)), so the thresholds should be tenant-editable, not hard-coded.
- "R200,000" is now correct only for **district** municipalities' competitive-bid threshold. "R30,000" is the **advertising** trigger, not a quotation band.

### Gaps
- Reg 12(1)(a) (petty cash up to R2,000) and reg 36 (deviations) text were not fetched this session.
- Whether any MFMA Circular accompanied the December 2023 amendment was not confirmed.
- The Preferential Procurement Regulations 2022 (80/20 and 90/10 scoring) were not researched.
- No 2025–2026 amendment to municipal thresholds was found, but a proclamation of the Public Procurement Act or new regulations after 25 November 2026 would change this. Re-check before publishing.
