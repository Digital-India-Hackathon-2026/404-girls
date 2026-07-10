// Health Profile JavaScript
// Handles profile editing, dynamic inputs, and data persistence

document.addEventListener('DOMContentLoaded', function() {
    // Load existing profile data
    loadProfileData();
    
    // Handle "Other" checkbox for allergies
    const profileOtherAllergyCheckbox = document.getElementById('profile-other-allergy');
    const profileOtherAllergyContainer = document.getElementById('profileOtherAllergyContainer');
    
    if (profileOtherAllergyCheckbox && profileOtherAllergyContainer) {
        profileOtherAllergyCheckbox.addEventListener('change', function() {
            if (this.checked) {
                profileOtherAllergyContainer.classList.add('show');
            } else {
                profileOtherAllergyContainer.classList.remove('show');
                document.getElementById('profileOtherAllergy').value = '';
            }
        });
    }
    
    // Handle "Other" radio for dietary preference
    const profileOtherDietRadio = document.getElementById('profile-other-diet');
    const profileOtherDietContainer = document.getElementById('profileOtherDietContainer');
    
    if (profileOtherDietRadio && profileOtherDietContainer) {
        const dietRadios = document.querySelectorAll('input[name="dietaryPreference"]');
        dietRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (profileOtherDietRadio.checked) {
                    profileOtherDietContainer.classList.add('show');
                } else {
                    profileOtherDietContainer.classList.remove('show');
                    document.getElementById('profileOtherDiet').value = '';
                }
            });
        });
    }
    
    // Handle "None" checkbox logic
    const profileNoneCheckbox = document.getElementById('profile-none');
    const profileAllergyCheckboxes = document.querySelectorAll('input[name="allergies"]');
    
    if (profileNoneCheckbox) {
        profileNoneCheckbox.addEventListener('change', function() {
            if (this.checked) {
                profileAllergyCheckboxes.forEach(cb => {
                    if (cb.id !== 'profile-none') {
                        cb.checked = false;
                        cb.closest('.checkbox-card').classList.remove('checked');
                    }
                });
            }
        });
        
        // Uncheck "None" if any other allergy is selected
        profileAllergyCheckboxes.forEach(cb => {
            if (cb.id !== 'profile-none') {
                cb.addEventListener('change', function() {
                    if (this.checked && profileNoneCheckbox.checked) {
                        profileNoneCheckbox.checked = false;
                        profileNoneCheckbox.closest('.checkbox-card').classList.remove('checked');
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
    
    // Profile Form Submission
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Collect updated profile data
            const profileData = {
                allergies: [],
                height: document.getElementById('profileHeight').value,
                weight: document.getElementById('profileWeight').value,
                age: document.getElementById('profileAge').value,
                dietaryPreference: null,
                otherAllergy: null,
                otherDiet: null,
                sensitivities: document.getElementById('sensitivities').value
            };
            
            // Collect allergies
            profileAllergyCheckboxes.forEach(cb => {
                if (cb.checked) {
                    profileData.allergies.push(cb.value);
                }
            });
            
            // Collect dietary preference
            const selectedDiet = document.querySelector('input[name="dietaryPreference"]:checked');
            if (selectedDiet) {
                profileData.dietaryPreference = selectedDiet.value;
            }
            
            // Collect "other" values if applicable
            if (profileOtherAllergyCheckbox && profileOtherAllergyCheckbox.checked) {
                profileData.otherAllergy = document.getElementById('profileOtherAllergy').value;
            }
            
            if (profileOtherDietRadio && profileOtherDietRadio.checked) {
                profileData.otherDiet = document.getElementById('profileOtherDiet').value;
            }
            
            // Show loading state
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span> Saving...';
            submitBtn.disabled = true;
            
            // Simulate API call to update profile
            setTimeout(() => {
                // Store updated profile data
                localStorage.setItem('healthProfile', JSON.stringify(profileData));
                
                // Success feedback
                submitBtn.innerHTML = '<i class="bi bi-check-circle"></i> Saved!';
                submitBtn.classList.remove('btn-primary');
                submitBtn.classList.add('btn-success');
                
                // Show success message
                showSuccessMessage();
                
                // Reset button after delay
                setTimeout(() => {
                    submitBtn.innerHTML = originalText;
                    submitBtn.classList.remove('btn-success');
                    submitBtn.classList.add('btn-primary');
                    submitBtn.disabled = false;
                }, 2000);
                
            }, 1500);
        });
    }
});

// Load existing profile data into form
function loadProfileData() {
    const healthProfile = localStorage.getItem('healthProfile');
    
    if (healthProfile) {
        try {
            const profile = JSON.parse(healthProfile);
            
            // Load allergies
            if (profile.allergies && Array.isArray(profile.allergies)) {
                profile.allergies.forEach(allergy => {
                    const checkbox = document.querySelector(`input[name="allergies"][value="${allergy}"]`);
                    if (checkbox) {
                        checkbox.checked = true;
                        checkbox.closest('.checkbox-card').classList.add('checked');
                        
                        // Show "other" input if needed
                        if (allergy === 'other' && profile.otherAllergy) {
                            const otherContainer = document.getElementById('profileOtherAllergyContainer');
                            const otherInput = document.getElementById('profileOtherAllergy');
                            if (otherContainer && otherInput) {
                                otherContainer.classList.add('show');
                                otherInput.value = profile.otherAllergy;
                            }
                        }
                    }
                });
            }
            
            // Load physical metrics
            if (profile.height) {
                document.getElementById('profileHeight').value = profile.height;
            }
            if (profile.weight) {
                document.getElementById('profileWeight').value = profile.weight;
            }
            if (profile.age) {
                document.getElementById('profileAge').value = profile.age;
            }
            
            // Load dietary preference
            if (profile.dietaryPreference) {
                const dietRadio = document.querySelector(`input[name="dietaryPreference"][value="${profile.dietaryPreference}"]`);
                if (dietRadio) {
                    dietRadio.checked = true;
                    dietRadio.closest('.checkbox-card').classList.add('checked');
                    
                    // Show "other" input if needed
                    if (profile.dietaryPreference === 'other' && profile.otherDiet) {
                        const otherContainer = document.getElementById('profileOtherDietContainer');
                        const otherInput = document.getElementById('profileOtherDiet');
                        if (otherContainer && otherInput) {
                            otherContainer.classList.add('show');
                            otherInput.value = profile.otherDiet;
                        }
                    }
                }
            }
            
            // Load sensitivities
            if (profile.sensitivities) {
                const sensitivitiesTextarea = document.getElementById('sensitivities');
                if (sensitivitiesTextarea) {
                    sensitivitiesTextarea.value = profile.sensitivities;
                }
            }
            
        } catch (e) {
            console.error('Error loading profile data:', e);
        }
    }
}

// Show success message
function showSuccessMessage() {
    // Create success alert
    const alert = document.createElement('div');
    alert.className = 'alert alert-success alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3';
    alert.style.zIndex = '9999';
    alert.innerHTML = `
        <i class="bi bi-check-circle-fill me-2"></i>
        <strong>Success!</strong> Your health profile has been updated.
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(alert);
    
    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        alert.classList.remove('show');
        setTimeout(() => alert.remove(), 150);
    }, 3000);
}

// Database Integration Comments
/*
    HEALTH PROFILE DATABASE INTEGRATION:
    
    In production, this would connect to:
    
    1. USER_HEALTH_PROFILES TABLE:
       Schema:
       - id (primary key)
       - user_id (foreign key to users table)
       - allergies (JSON array or separate allergy_mappings table)
       - height (decimal)
       - weight (decimal)
       - age (integer)
       - dietary_preference (varchar)
       - sensitivities (text)
       - created_at (timestamp)
       - updated_at (timestamp)
    
    2. API ENDPOINTS:
       - GET /api/user/profile - Fetch current profile
       - PUT /api/user/profile - Update profile
       - POST /api/user/profile/validate - Validate profile data
    
    3. PROFILE VALIDATION:
       - Server-side validation for age, height, weight ranges
       - Allergy cross-reference with known allergen database
       - Dietary preference standardization
    
    4. PERSONALIZATION ENGINE:
       - When profile updates, trigger re-calculation of:
         * Product compatibility scores
         * Personalized warnings
         * Recommended alternatives
       - Update cached user preferences
    
    5. AUDIT LOG:
       - Track profile changes in 'profile_change_history' table
       - Useful for: support, compliance, analytics
       - Schema: id, user_id, changed_field, old_value, new_value, timestamp
*/