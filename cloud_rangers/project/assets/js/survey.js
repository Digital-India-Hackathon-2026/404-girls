// Health Survey JavaScript
// Handles survey form, dynamic inputs, and progress tracking

document.addEventListener('DOMContentLoaded', function() {
    // Progress tracking
    const surveyForm = document.getElementById('surveyForm');
    const progressBar = document.getElementById('surveyProgress');
    
    // Update progress as user fills out form
    function updateProgress() {
        const allInputs = surveyForm.querySelectorAll('input[type="checkbox"]:checked, input[type="radio"]:checked, input[type="number"], input[type="text"]');
        const filledInputs = Array.from(allInputs).filter(input => {
            if (input.type === 'number' || input.type === 'text') {
                return input.value.trim() !== '';
            }
            return input.checked;
        });
        
        const totalFields = 5; // Age is required, others optional
        const filledFields = Math.min(filledInputs.length, totalFields);
        const progress = (filledFields / totalFields) * 100;
        
        progressBar.style.width = progress + '%';
    }
    
    // Listen to all inputs
    if (surveyForm) {
        surveyForm.addEventListener('change', updateProgress);
        surveyForm.addEventListener('input', updateProgress);
    }
    
    // Handle "Other" checkbox for allergies
    const allergyOtherCheckbox = document.getElementById('allergy-other');
    const otherAllergyContainer = document.getElementById('otherAllergyContainer');
    
    if (allergyOtherCheckbox && otherAllergyContainer) {
        allergyOtherCheckbox.addEventListener('change', function() {
            if (this.checked) {
                otherAllergyContainer.classList.add('show');
            } else {
                otherAllergyContainer.classList.remove('show');
                document.getElementById('otherAllergy').value = '';
            }
        });
    }
    
    // Handle "Other" radio for dietary preference
    const dietOtherRadio = document.getElementById('diet-other');
    const otherDietContainer = document.getElementById('otherDietContainer');
    
    if (dietOtherRadio && otherDietContainer) {
        const dietRadios = document.querySelectorAll('input[name="dietaryPreference"]');
        dietRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (dietOtherRadio.checked) {
                    otherDietContainer.classList.add('show');
                } else {
                    otherDietContainer.classList.remove('show');
                    document.getElementById('otherDiet').value = '';
                }
            });
        });
    }
    
    // Handle "None" checkbox logic - uncheck others if "None" is selected
    const noneCheckbox = document.getElementById('allergy-none');
    const allergyCheckboxes = document.querySelectorAll('input[name="allergies"]');
    
    if (noneCheckbox) {
        noneCheckbox.addEventListener('change', function() {
            if (this.checked) {
                allergyCheckboxes.forEach(cb => {
                    if (cb.id !== 'allergy-none') {
                        cb.checked = false;
                    }
                });
            }
        });
        
        // Uncheck "None" if any other allergy is selected
        allergyCheckboxes.forEach(cb => {
            if (cb.id !== 'allergy-none') {
                cb.addEventListener('change', function() {
                    if (this.checked && noneCheckbox.checked) {
                        noneCheckbox.checked = false;
                    }
                });
            }
        });
    }
    
    // Checkbox card styling
    const checkboxCards = document.querySelectorAll('.checkbox-card');
    checkboxCards.forEach(card => {
        const checkbox = card.querySelector('input[type="checkbox"], input[type="radio"]');
        if (checkbox) {
            // Initial state
            if (checkbox.checked) {
                card.classList.add('checked');
            }
            
            // Toggle on change
            checkbox.addEventListener('change', function() {
                if (this.type === 'checkbox') {
                    if (this.checked) {
                        card.classList.add('checked');
                    } else {
                        card.classList.remove('checked');
                    }
                } else if (this.type === 'radio') {
                    // Remove checked from all cards in the same group
                    const groupCards = document.querySelectorAll(`.checkbox-card input[name="${this.name}"]`);
                    groupCards.forEach(radio => {
                        radio.closest('.checkbox-card').classList.remove('checked');
                    });
                    // Add to current
                    if (this.checked) {
                        card.classList.add('checked');
                    }
                }
            });
            
            // Make entire card clickable
            card.addEventListener('click', function(e) {
                if (e.target !== checkbox && e.target.tagName !== 'LABEL') {
                    checkbox.click();
                }
            });
        }
    });
    
    // Survey Form Submission
    if (surveyForm) {
        surveyForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get age (required field)
            const age = document.getElementById('age').value;
            
            if (!age) {
                alert('Please enter your age to continue.');
                document.getElementById('age').classList.add('is-invalid');
                return;
            }
            
            // Collect all survey data
            const surveyData = {
                allergies: [],
                height: document.getElementById('height').value,
                weight: document.getElementById('weight').value,
                age: age,
                dietaryPreference: null,
                otherAllergy: null,
                otherDiet: null
            };
            
            // Collect allergies
            allergyCheckboxes.forEach(cb => {
                if (cb.checked) {
                    surveyData.allergies.push(cb.value);
                }
            });
            
            // Collect dietary preference
            const selectedDiet = document.querySelector('input[name="dietaryPreference"]:checked');
            if (selectedDiet) {
                surveyData.dietaryPreference = selectedDiet.value;
            }
            
            // Collect "other" values if applicable
            if (allergyOtherCheckbox && allergyOtherCheckbox.checked) {
                surveyData.otherAllergy = document.getElementById('otherAllergy').value;
            }
            
            if (dietOtherRadio && dietOtherRadio.checked) {
                surveyData.otherDiet = document.getElementById('otherDiet').value;
            }
            
            // Show loading state
            const btnText = this.querySelector('.btn-text');
            const btnLoader = this.querySelector('.btn-loader');
            const submitBtn = this.querySelector('button[type="submit"]');
            
            btnText.style.display = 'none';
            btnLoader.style.display = 'inline-flex';
            submitBtn.disabled = true;
            
            // Simulate API call to save survey data
            setTimeout(() => {
                // Store survey data in localStorage (in production, send to backend API)
                localStorage.setItem('healthProfile', JSON.stringify(surveyData));
                localStorage.setItem('hasCompletedSurvey', 'true');
                
                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            }, 1500);
        });
    }
});

// Skip survey function
function skipSurvey() {
    if (confirm('Are you sure you want to skip? Personalized warnings will be limited without your health profile.')) {
        localStorage.setItem('hasCompletedSurvey', 'true');
        window.location.href = 'dashboard.html';
    }
}