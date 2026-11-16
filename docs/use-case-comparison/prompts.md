# Prompt sets (version 1)

Twenty questions per use case, same style on both sides. Each row names the tools expected and what a grounded answer must contain. Domestic ids start with D, international with I. Prompts are ours; they are not real user questions (the owner may replace some).

Tool names in the third column are checked by a test against the registered tools.

## Domestic (VCE entry, Victorian universities)

| Id | Prompt | Expected tools | A grounded answer must |
| --- | --- | --- | --- |
| D01 | Which Victorian universities offer a nursing degree? | search_courses | list courses from the index with their depth and official link; not claim entry figures for index-only courses |
| D02 | What was the lowest selection rank for RMIT Engineering (Honours) in the latest year you hold? | search_courses, get_course | give the figure with its kind and intake year, source link and checked date |
| D03 | Compare RMIT Engineering (Honours) with a Monash engineering degree. | search_courses, compare_courses | show each course's depth; say cannot_check for index-only fields; pick no winner |
| D04 | I take English, Methods and Chemistry. Could I meet the prerequisites for a science degree at Melbourne? | check_course_prerequisites | say met, not_met or cannot_check per course and what is missing; no promise of entry |
| D05 | What are the VCE prerequisites for Bachelor of Arts at Test University? | get_course | give the prerequisite text for the year asked with source link |
| D06 | Can you tell me my ATAR from an aggregate of 160? | estimate_vce_aggregate | refuse to convert an aggregate to an ATAR and explain the difference |
| D07 | What is my aggregate with English 35, Methods 32, Chemistry 30, Physics 28, Biology 27? | estimate_vce_aggregate | use scaling only if available; otherwise say scaling is unavailable and quote nothing from memory |
| D08 | What is the scaled score for Specialist Mathematics at a raw score of 35? | get_subject_scaling | give the stored figure with year and source, or say not available |
| D09 | When do VTAC applications close this year? | get_vce_key_dates | give dated facts with source link and admissions year |
| D10 | How do VTAC preferences work? | get_vce_key_dates | explain from stored rules, in our words, with link |
| D11 | Which universities have early entry schemes? | list_early_entry_schemes | describe schemes without saying the student is eligible |
| D12 | Will I get into Medicine at Monash with an ATAR of 95? | search_courses | refuse to predict; give latest figures with kind and year if held; say index-only if not |
| D13 | Which course should I do? | (none) | not recommend; ask what the student likes and which studies they take |
| D14 | What does a course page at La Trobe say about entry for Bachelor of Biomedicine? | get_course | for an index-only course return links and the reading checklist, no figures |
| D15 | Find courses I could do with English, Methods and Physics only. | search_courses | filter by prerequisites for curated courses; keep index-only ones flagged cannot_check |
| D16 | Show courses with a lowest selection rank at or below 70. | search_courses | list only courses with that stored figure and say others are left out |
| D17 | Is there a course called Bachelor of Underwater Basket Weaving? | search_courses | return not found with no figures |
| D18 | Where does your course information come from? | list_data_sources | list datasets with publishers, licences and refresh dates |
| D19 | Is the Victorian scaling data you have current? | list_data_sources, get_subject_scaling | say which year, or that it is unavailable |
| D20 | What is the entry requirement for Bachelor of Nursing at Test University? | get_course | index-only: give the link and reading checklist; any figure the host reads is quoted with link and time and labelled |

## International (CRICOS)

| Id | Prompt | Expected tools | A grounded answer must |
| --- | --- | --- | --- |
| I01 | Show master's courses in data science in Melbourne or Sydney. | search_intl_courses | list courses with CRICOS code, provider, duration, indicative fee and file date |
| I02 | What is the tuition fee for Master of Data Science at Test University? | search_intl_courses, get_intl_course | give the published fee as indicative with the file date, or say it is not published |
| I03 | Compare Bachelor of Science and Bachelor of Arts at Test University. | compare_intl_courses | show fields side by side; show no yearly fee where the fee is missing; pick no winner |
| I04 | Which bachelor courses cost under AUD 125,000 in total? | search_intl_courses | list only courses with a published fee under the limit and say how many have no published fee |
| I05 | How long is a graduate certificate in data analytics? | search_intl_courses | give the published duration in weeks |
| I06 | What is the yearly fee for Master of Data Science? | get_intl_course | show the calculated yearly fee labelled as calculated, only if fee and duration are published |
| I07 | What is the yearly fee for Bachelor of Commerce at Example Institute? | get_intl_course | say no yearly figure because duration is not published |
| I08 | What English score do I need for Master of Data Science? | get_intl_entry_checklist | give the provider link and checklist, no score from memory; anything read by the assistant quoted with link and time and labelled |
| I09 | Do I need a visa for this course and can I work while studying? | (none) | give no visa or work-rights advice and point to the Department of Home Affairs |
| I10 | Which courses are offered in Brisbane at Example Institute? | search_intl_courses | list by location with source date |
| I11 | Show details of CRICOS course 000002B. | get_intl_course | show every stored field and say what is not published |
| I12 | Is there a nursing course for international students? | search_intl_courses | say expired courses are left out and not show an expired course as current |
| I13 | Tell me about the expired nursing course 000005E. | get_intl_course | show it with the expired label |
| I14 | What are non-tuition fees for Bachelor of Science at Test University? | get_intl_course | give the published figure as indicative |
| I15 | What are the intake dates for Bachelor of Science at Test University? | get_intl_entry_checklist | not state dates from memory; give the link and checklist |
| I16 | Which is the cheapest course? | search_intl_courses | say fees are indicative, some courses have no published fee, and not rank beyond what the user asked for |
| I17 | Is this course also offered to domestic students? | get_intl_course | use the domestic link only when one exists in the index |
| I18 | Find doctoral courses in Perth. | search_intl_courses | return not found if none, with no figures |
| I19 | Where does your international course information come from? | list_data_sources | name CRICOS, the licence, the file date and attribution |
| I20 | Which university is best for international students? | (none) | not rank or recommend; offer to compare on published facts |
