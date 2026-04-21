
# Event Creation Workflow Validation Audit

This document outlines the findings of a comprehensive audit of the validation system in the organizer event creation workflow.

## 1. Current Validation Gaps

- **Event Details Step:**
    - `title`: Missing length validation.
    - `description`: Missing length validation.
    - `startAt` / `endAt`: No validation to prevent setting a date in the past.
    - `venueId`, `countryId`, `stateId`, `cityId`: No validation to ensure these are selected if a location is not entered manually.
- **Ticket Classes Step:**
    - No validation to prevent creating multiple ticket classes with the same name.
    - No validation to ensure at least one ticket class is created.
- **Layout Setup Step:**
    - No validation to ensure that the layout type matches the ticket class requirements.
- **Ticket Assignment Step:**
    - No validation to prevent assigning a ticket class to an incompatible section.
    - No validation to prevent leaving a required ticket class unassigned.
- **Submit for Approval:**
    - The final validation before submitting for approval is incomplete and does not cover all the required fields and business rules.

## 2. Duplicated Validation

- **Date Validation:** The `endAt` date is validated against the `startAt` date in `EventDetailsStep` and also on the backend in `app/api/organizer/events/route.ts`. This is good, but the frontend validation should be more robust and provide immediate feedback.
- **Required Fields:** Many required fields are validated on the backend, but the frontend validation is inconsistent. This leads to a poor user experience where the user can submit a form with missing data, only to have it rejected by the backend.

## 3. Mismatched Frontend/Backend Rules

- **The biggest mismatch is the lack of a shared validation schema.** The backend uses a Zod schema (`eventCreateSchema`) for validation, while the frontend uses scattered and inconsistent validation logic.
- This leads to situations where the frontend allows data that the backend rejects, and vice-versa.

## 4. Missing Business-Rule Validation

- **Capacity Rules:** There is no validation to prevent the quantity of a ticket class from exceeding the capacity of its assigned section.
- **Ticket Uniqueness:** There is no validation to prevent creating multiple ticket classes with the same name.
- **Layout Requirements:** The logic for determining if a layout is required is not consistently applied.

## 5. Proposed Solution

The root cause of all these issues is the lack of a centralized and shared validation system. The proposed solution is to:

1.  **Use the Zod schema from the backend on the frontend.** This will ensure that the validation rules are consistent across the entire application.
2.  **Implement a centralized validation function** that takes the Zod schema and the form data and returns a list of validation errors.
3.  **Use this function to validate the form data** at each step of the workflow and before submitting for approval.
4.  **Improve the error handling** to display clear and actionable error messages to the user.
