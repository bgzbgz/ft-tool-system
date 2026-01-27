/**
 * Fast Track Pre-Submission Questionnaire - State Management
 * Spec: 014-pre-submission-questionnaire
 * Per contracts/questionnaire-state.yaml
 */

import { QuestionnaireState, QuestionnaireAnswers } from './types';

// ========== CONSTANTS ==========

const STORAGE_KEY = 'ft_questionnaire_state';

// ========== STATE ==========

let currentState: QuestionnaireState = createInitialState();

// ========== STATE FUNCTIONS ==========

/**
 * Create initial questionnaire state
 */
export function createInitialState(): QuestionnaireState {
  return {
    currentStep: 1,
    answers: {
      category: 'b2b_service', // Default category
      decision: '',
      teaching: '',
      inputTypes: [],
      scoringCriteria: ''
    },
    isSubmitting: false,
    lastUpdated: null
  };
}

/**
 * Get current questionnaire state
 */
export function getCurrentState(): QuestionnaireState {
  return currentState;
}

/**
 * Update questionnaire state with partial updates
 */
export function updateState(updates: Partial<QuestionnaireState>): QuestionnaireState {
  currentState = {
    ...currentState,
    ...updates,
    lastUpdated: new Date().toISOString()
  };

  // Save to localStorage after every state change (US4)
  saveToLocalStorage();

  return currentState;
}

/**
 * Update a specific answer field
 */
export function updateAnswer<K extends keyof QuestionnaireAnswers>(
  field: K,
  value: QuestionnaireAnswers[K]
): QuestionnaireState {
  return updateState({
    answers: {
      ...currentState.answers,
      [field]: value
    }
  });
}

/**
 * Reset state to initial values
 */
export function resetState(): QuestionnaireState {
  currentState = createInitialState();
  clearLocalStorage();
  return currentState;
}

/**
 * Go to specific step
 */
export function goToStep(step: number): QuestionnaireState {
  if (step < 1 || step > 6) {
    console.warn('[Questionnaire] Invalid step:', step);
    return currentState;
  }

  return updateState({ currentStep: step });
}

/**
 * Go to next step
 */
export function nextStep(): QuestionnaireState {
  if (currentState.currentStep >= 6) {
    return currentState;
  }

  return updateState({ currentStep: currentState.currentStep + 1 });
}

/**
 * Go to previous step
 */
export function previousStep(): QuestionnaireState {
  if (currentState.currentStep <= 1) {
    return currentState;
  }

  return updateState({ currentStep: currentState.currentStep - 1 });
}

/**
 * Set submitting state
 */
export function setSubmitting(isSubmitting: boolean): QuestionnaireState {
  return updateState({ isSubmitting });
}

// ========== LOCALSTORAGE FUNCTIONS (US4) ==========

/**
 * Save current state to localStorage
 */
export function saveToLocalStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
  } catch (error) {
    // localStorage might be disabled or full - continue without persistence
    console.warn('[Questionnaire] Could not save to localStorage:', error);
  }
}

/**
 * Load state from localStorage
 * Returns true if state was restored, false otherwise
 */
export function loadFromLocalStorage(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as QuestionnaireState;

      // Validate the stored state has required fields
      if (
        typeof parsed.currentStep === 'number' &&
        parsed.answers &&
        typeof parsed.answers.decision === 'string'
      ) {
        currentState = parsed;
        console.log('[Questionnaire] Restored state from localStorage, step:', parsed.currentStep);
        return true;
      }
    }
  } catch (error) {
    // localStorage might be disabled or data corrupted - start fresh
    console.warn('[Questionnaire] Could not load from localStorage:', error);
  }

  return false;
}

/**
 * Clear localStorage data
 */
export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[Questionnaire] Cleared localStorage');
  } catch (error) {
    console.warn('[Questionnaire] Could not clear localStorage:', error);
  }
}

// ========== EXPORTS ==========

export {
  STORAGE_KEY
};
