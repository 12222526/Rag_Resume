// API Configuration
const API_BASE = 'http://localhost:5000/api';

// Global state
let currentPage = 'upload';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    showPage('upload');
    loadRecentUploads();
    loadJobs();
});

// Navigation functions
function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
    
    // Show selected page
    document.getElementById(pageName + '-page').classList.remove('hidden');
    
    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-white', 'bg-opacity-20');
    });
    
    // Highlight current page button
    event.target.classList.add('bg-white', 'bg-opacity-20');
    
    currentPage = pageName;
    
    // Load page-specific data
    if (pageName === 'search') {
        loadResumes();
    } else if (pageName === 'jobs') {
        loadJobs();
    } else if (pageName === 'eligibility') {
        // Reset eligibility form
        document.getElementById('eligibility-upload-form').reset();
        document.getElementById('eligibility-results').classList.add('hidden');
    }
}

// Upload functionality
document.getElementById('upload-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData();
    const files = document.getElementById('file-upload').files;
    
    if (files.length === 0) {
        showError('Please select files to upload');
        return;
    }
    
    showLoading(true);
    
    try {
        for (let file of files) {
            formData.append('files', file);
        }
        
        const response = await fetch(`${API_BASE}/resumes/upload`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showUploadSuccess(result);
            loadRecentUploads();
            document.getElementById('upload-form').reset();
        } else {
            showError(result.error || 'Upload failed');
        }
    } catch (error) {
        showError('Upload failed: ' + error.message);
    } finally {
        showLoading(false);
    }
});

// ZIP upload functionality
document.getElementById('zip-upload').addEventListener('change', async function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    showLoading(true);
    
    try {
        const formData = new FormData();
        formData.append('zipfile', file);
        
        const response = await fetch(`${API_BASE}/resumes/upload-zip`, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showUploadSuccess(result);
            loadRecentUploads();
        } else {
            showError(result.error || 'ZIP upload failed');
        }
    } catch (error) {
        showError('ZIP upload failed: ' + error.message);
    } finally {
        showLoading(false);
        e.target.value = '';
    }
});

// Search functionality
async function searchResumes() {
    const query = document.getElementById('search-query').value.trim();
    if (!query) {
        showError('Please enter a search query');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/search/resumes?q=${encodeURIComponent(query)}&limit=10`);
        const result = await response.json();
        
        if (response.ok) {
            displaySearchResults(result);
        } else {
            showError(result.error || 'Search failed');
        }
    } catch (error) {
        showError('Search failed: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Ask question functionality
async function askQuestion() {
    const question = document.getElementById('question-input').value.trim();
    const topK = document.getElementById('top-k').value;
    
    if (!question) {
        showError('Please enter a question');
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/search/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                query: question,
                k: parseInt(topK)
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            displayQuestionResults(result);
        } else {
            showError(result.error || 'Question processing failed');
        }
    } catch (error) {
        showError('Question processing failed: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Job creation functionality
document.getElementById('job-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const jobData = {
        title: formData.get('title'),
        company: formData.get('company'),
        description: formData.get('description'),
        requirements: formData.get('requirements'),
        location: formData.get('location'),
        experience: formData.get('experience'),
        employmentType: formData.get('employmentType'),
        skills: formData.get('skills').split(',').map(s => s.trim()).filter(s => s)
    };
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(jobData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showSuccess('Job created successfully');
            loadJobs();
            e.target.reset();
        } else {
            showError(result.error || 'Job creation failed');
        }
    } catch (error) {
        showError('Job creation failed: ' + error.message);
    } finally {
        showLoading(false);
    }
});

// Load recent uploads
async function loadRecentUploads() {
    try {
        const response = await fetch(`${API_BASE}/resumes?limit=5`);
        const result = await response.json();
        
        if (response.ok) {
            displayRecentUploads(result.resumes);
        }
    } catch (error) {
        console.error('Failed to load recent uploads:', error);
    }
}

// Load jobs
async function loadJobs() {
    try {
        const response = await fetch(`${API_BASE}/jobs?limit=20`);
        const result = await response.json();
        
        if (response.ok) {
            displayJobs(result.jobs);
        }
    } catch (error) {
        console.error('Failed to load jobs:', error);
    }
}

// Match job functionality
async function matchJob(jobId) {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/jobs/${jobId}/match`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ top_n: 10 })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showMatchResults(result);
        } else {
            showError(result.error || 'Job matching failed');
        }
    } catch (error) {
        showError('Job matching failed: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// View candidate profile
async function viewCandidate(resumeId) {
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/search/candidates/${resumeId}?includeText=true&redactPII=true`);
        const result = await response.json();
        
        if (response.ok) {
            showCandidateProfile(result);
        } else {
            showError(result.error || 'Failed to load candidate profile');
        }
    } catch (error) {
        showError('Failed to load candidate profile: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Display functions
function displayRecentUploads(resumes) {
    const container = document.getElementById('recent-uploads');
    
    if (resumes.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">No recent uploads</p>';
        return;
    }
    
    container.innerHTML = resumes.map(resume => `
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div class="flex-1">
                <h4 class="font-medium text-gray-900">${resume.originalName}</h4>
                <p class="text-sm text-gray-600">${resume.metadata.name || 'Unknown'} • ${formatDate(resume.createdAt)}</p>
            </div>
            <button onclick="viewCandidate('${resume._id}')" class="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                View Profile
            </button>
        </div>
    `).join('');
}

function displayJobs(jobs) {
    const container = document.getElementById('jobs-list');
    
    if (jobs.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">No jobs created yet</p>';
        return;
    }
    
    container.innerHTML = jobs.map(job => `
        <div class="border border-gray-200 rounded-lg p-4 card-hover">
            <div class="flex justify-between items-start">
                <div class="flex-1">
                    <h4 class="text-lg font-medium text-gray-900">${job.title}</h4>
                    <p class="text-gray-600">${job.company} • ${job.location || 'Remote'}</p>
                    <p class="text-sm text-gray-500 mt-1">${job.description.substring(0, 200)}...</p>
                    <div class="flex items-center mt-2 text-sm text-gray-500">
                        <span>${job.employmentType} • ${job.experience}</span>
                    </div>
                </div>
                <div class="flex space-x-2 ml-4">
                    <button onclick="matchJob('${job._id}')" class="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
                        <i class="fas fa-search mr-1"></i>Match
                    </button>
                    <button onclick="viewJob('${job._id}')" class="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700">
                        <i class="fas fa-eye mr-1"></i>View
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function displaySearchResults(result) {
    const container = document.getElementById('search-results-content');
    const resultsDiv = document.getElementById('search-results');
    
    if (result.results.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">No results found</p>';
    } else {
        container.innerHTML = result.results.map(resume => `
            <div class="border border-gray-200 rounded-lg p-4 card-hover">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <h4 class="text-lg font-medium text-gray-900">${resume.candidateName || 'Unknown'}</h4>
                        <p class="text-gray-600">${resume.resumeName} • Score: ${resume.score}%</p>
                        <p class="text-sm text-gray-500 mt-2">${resume.snippet}</p>
                        <div class="flex flex-wrap gap-2 mt-2">
                            ${resume.skills.map(skill => `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">${skill}</span>`).join('')}
                        </div>
                    </div>
                    <button onclick="viewCandidate('${resume.resumeId}')" class="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700 ml-4">
                        <i class="fas fa-eye mr-1"></i>View Profile
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    resultsDiv.classList.remove('hidden');
}

function displayQuestionResults(result) {
    const container = document.getElementById('question-results-content');
    const resultsDiv = document.getElementById('question-results');
    
    if (result.results.length === 0) {
        container.innerHTML = '<p class="text-gray-500 text-center">No results found</p>';
    } else {
        container.innerHTML = result.results.map(resume => `
            <div class="border border-gray-200 rounded-lg p-6 card-hover">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-lg font-medium text-gray-900">${resume.candidateName || 'Unknown'}</h4>
                        <p class="text-gray-600">${resume.resumeName} • Match Score: ${resume.score}%</p>
                    </div>
                    <button onclick="viewCandidate('${resume.resumeId}')" class="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700">
                        <i class="fas fa-eye mr-1"></i>View Profile
                    </button>
                </div>
                <div class="space-y-3">
                    <h5 class="font-medium text-gray-900">Evidence:</h5>
                    ${resume.evidence.map(evidence => `
                        <div class="bg-gray-50 p-3 rounded border-l-4 border-indigo-400">
                            <p class="text-sm text-gray-700">${evidence.text}</p>
                            <p class="text-xs text-gray-500 mt-1">Relevance: ${evidence.similarity}%</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }
    
    resultsDiv.classList.remove('hidden');
}

function showMatchResults(result) {
    // Create a modal to show match results
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-gray-900">Job Match Results</h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="space-y-4">
                ${result.matches.map(match => `
                    <div class="border border-gray-200 rounded-lg p-4">
                        <div class="flex justify-between items-start">
                            <div class="flex-1">
                                <h4 class="font-medium text-gray-900">${match.candidateName || 'Unknown'}</h4>
                                <p class="text-gray-600">${match.resumeName} • Score: ${match.score}%</p>
                                <div class="mt-2">
                                    <div class="flex flex-wrap gap-2">
                                        ${match.strengths.map(strength => `<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">${strength}</span>`).join('')}
                                    </div>
                                    ${match.missingRequirements.length > 0 ? `
                                        <div class="mt-2">
                                            <p class="text-sm font-medium text-red-600">Missing Requirements:</p>
                                            <div class="flex flex-wrap gap-2 mt-1">
                                                ${match.missingRequirements.map(req => `<span class="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">${req}</span>`).join('')}
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            <button onclick="viewCandidate('${match.resumeId}')" class="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-700 ml-4">
                                <i class="fas fa-eye mr-1"></i>View Profile
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function showCandidateProfile(candidate) {
    // Create a modal to show candidate profile
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-gray-900 bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-96 overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-gray-900">Candidate Profile</h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="space-y-4">
                <div>
                    <h4 class="font-medium text-gray-900">${candidate.metadata.name || 'Unknown'}</h4>
                    <p class="text-gray-600">${candidate.resumeName}</p>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <h5 class="font-medium text-gray-900">Contact</h5>
                        <p class="text-sm text-gray-600">Email: ${candidate.metadata.email || 'N/A'}</p>
                        <p class="text-sm text-gray-600">Phone: ${candidate.metadata.phone || 'N/A'}</p>
                    </div>
                    <div>
                        <h5 class="font-medium text-gray-900">Experience</h5>
                        <p class="text-sm text-gray-600">${candidate.metadata.experience || 0} years</p>
                    </div>
                </div>
                <div>
                    <h5 class="font-medium text-gray-900">Skills</h5>
                    <div class="flex flex-wrap gap-2 mt-1">
                        ${candidate.metadata.skills.map(skill => `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">${skill}</span>`).join('')}
                    </div>
                </div>
                <div>
                    <h5 class="font-medium text-gray-900">Education</h5>
                    <div class="space-y-1">
                        ${candidate.metadata.education.map(edu => `<p class="text-sm text-gray-600">${edu}</p>`).join('')}
                    </div>
                </div>
                <div>
                    <h5 class="font-medium text-gray-900">Summary</h5>
                    <p class="text-sm text-gray-600">${candidate.metadata.summary || 'No summary available'}</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Utility functions
function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showError(message) {
    showNotification(message, 'error');
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 ${
        type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`;
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'} mr-2"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function showUploadSuccess(result) {
    const resultsDiv = document.getElementById('upload-results');
    const messageDiv = document.getElementById('upload-message');
    
    messageDiv.innerHTML = `
        Successfully uploaded ${result.count} resume(s):
        <ul class="mt-2 list-disc list-inside">
            ${result.resumes.map(r => `<li>${r.originalName}</li>`).join('')}
        </ul>
    `;
    
    resultsDiv.classList.remove('hidden');
    
    setTimeout(() => {
        resultsDiv.classList.add('hidden');
    }, 10000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Eligibility Check Functionality
document.getElementById('eligibility-upload-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const file = document.getElementById('eligibility-file-upload').files[0];
    if (!file) {
        showError('Please select a resume file');
        return;
    }
    
    // First upload the resume
    const formData = new FormData();
    formData.append('files', file);
    
    showLoading(true);
    
    try {
        const uploadResponse = await fetch(`${API_BASE}/resumes/upload`, {
            method: 'POST',
            body: formData
        });
        
        const uploadResult = await uploadResponse.json();
        
        if (uploadResponse.ok && uploadResult.resumes.length > 0) {
            const resumeId = uploadResult.resumes[0].id;
            
            // Get eligibility criteria
            const requiredSkills = document.getElementById('required-skills').value
                .split(',').map(s => s.trim()).filter(s => s);
            const minExperience = parseInt(document.getElementById('min-experience').value) || 0;
            const requiredEducation = document.getElementById('required-education').value;
            const requiredCertifications = document.getElementById('required-certifications').value
                .split(',').map(s => s.trim()).filter(s => s);
            const additionalRequirements = document.getElementById('additional-requirements').value;
            
            // Check eligibility
            const eligibilityResponse = await fetch(`${API_BASE}/search/eligibility/${resumeId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requiredSkills,
                    minExperience,
                    requiredEducation,
                    requiredCertifications,
                    additionalRequirements
                })
            });
            
            const eligibilityResult = await eligibilityResponse.json();
            
            if (eligibilityResponse.ok) {
                displayEligibilityResults(eligibilityResult);
            } else {
                showError(eligibilityResult.error || 'Eligibility check failed');
            }
        } else {
            showError(uploadResult.error || 'Upload failed');
        }
    } catch (error) {
        showError('Eligibility check failed: ' + error.message);
    } finally {
        showLoading(false);
    }
});

// Template functions for eligibility criteria
function applyTemplate(templateType) {
    const templates = {
        'web-developer': {
            skills: 'JavaScript, React, Node.js, HTML, CSS, TypeScript',
            experience: 3,
            education: 'bachelor',
            certifications: '',
            additional: 'Experience with modern web development frameworks and tools'
        },
        'data-scientist': {
            skills: 'Python, Machine Learning, SQL, Statistics, Data Analysis',
            experience: 5,
            education: 'master',
            certifications: 'AWS, Machine Learning Certification',
            additional: 'Experience with data visualization and statistical modeling'
        },
        'devops-engineer': {
            skills: 'AWS, Docker, Kubernetes, CI/CD, Linux, Terraform',
            experience: 4,
            education: 'bachelor',
            certifications: 'AWS Certified Solutions Architect, Kubernetes Certification',
            additional: 'Experience with cloud infrastructure and automation'
        },
        'product-manager': {
            skills: 'Agile, Scrum, Product Strategy, User Research, Analytics',
            experience: 5,
            education: 'bachelor',
            certifications: 'PMP, Scrum Master, Product Owner',
            additional: 'Experience with product lifecycle management and stakeholder communication'
        },
        'ui-ux-designer': {
            skills: 'Figma, Adobe Creative Suite, User Research, Prototyping, Wireframing',
            experience: 3,
            education: 'bachelor',
            certifications: 'UX Certification, Adobe Certified Expert',
            additional: 'Experience with design systems and user-centered design principles'
        },
        'mobile-developer': {
            skills: 'React Native, Swift, Kotlin, Flutter, iOS, Android',
            experience: 4,
            education: 'bachelor',
            certifications: 'iOS Developer, Android Developer',
            additional: 'Experience with mobile app development and cross-platform solutions'
        }
    };
    
    const template = templates[templateType];
    if (template) {
        document.getElementById('required-skills').value = template.skills;
        document.getElementById('min-experience').value = template.experience;
        document.getElementById('required-education').value = template.education;
        document.getElementById('required-certifications').value = template.certifications;
        document.getElementById('additional-requirements').value = template.additional;
    }
}

function displayEligibilityResults(results) {
    const container = document.getElementById('eligibility-results-content');
    const resultsDiv = document.getElementById('eligibility-results');
    
    const statusColor = results.isEligible ? 'green' : 'red';
    const statusIcon = results.isEligible ? 'check-circle' : 'times-circle';
    
    container.innerHTML = `
        <div class="mb-6">
            <div class="bg-${statusColor}-50 border border-${statusColor}-200 rounded-lg p-4">
                <div class="flex items-center">
                    <i class="fas fa-${statusIcon} text-${statusColor}-600 mr-3 text-2xl"></i>
                    <div>
                        <h4 class="text-lg font-semibold text-${statusColor}-800">
                            ${results.isEligible ? 'Eligible' : 'Not Eligible'}
                        </h4>
                        <p class="text-${statusColor}-700">
                            Overall Score: ${results.overallScore}% - ${results.candidateName}
                        </p>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            ${Object.entries(results.criteria).map(([key, criterion]) => {
                if (criterion.status === 'pending') return '';
                
                const statusColor = criterion.status === 'pass' ? 'green' : 
                                  criterion.status === 'partial' ? 'yellow' : 'red';
                const statusIcon = criterion.status === 'pass' ? 'check' : 
                                  criterion.status === 'partial' ? 'exclamation' : 'times';
                
                return `
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <div class="flex items-center justify-between mb-2">
                            <h5 class="font-medium text-gray-800 capitalize">${key}</h5>
                            <span class="text-${statusColor}-600">
                                <i class="fas fa-${statusIcon} mr-1"></i>
                                ${criterion.score}%
                            </span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-${statusColor}-500 h-2 rounded-full" style="width: ${criterion.score}%"></div>
                        </div>
                        ${criterion.details.matched ? `
                            <div class="mt-2 text-sm">
                                <p class="text-green-600">✓ ${criterion.details.matched.length} matched</p>
                                ${criterion.details.missing ? `<p class="text-red-600">✗ ${criterion.details.missing.length} missing</p>` : ''}
                            </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>
        
        ${results.missingRequirements.length > 0 ? `
            <div class="mb-6">
                <h5 class="font-medium text-gray-800 mb-3">Missing Requirements</h5>
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <ul class="text-red-700 space-y-1">
                        ${results.missingRequirements.map(req => `<li>• ${req}</li>`).join('')}
                    </ul>
                </div>
            </div>
        ` : ''}
        
        ${results.recommendations.length > 0 ? `
            <div class="mb-6">
                <h5 class="font-medium text-gray-800 mb-3">Recommendations</h5>
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <ul class="text-blue-700 space-y-1">
                        ${results.recommendations.map(rec => `<li>• ${rec}</li>`).join('')}
                    </ul>
                </div>
            </div>
        ` : ''}
        
        <div class="text-center">
            <button onclick="document.getElementById('eligibility-results').classList.add('hidden')" 
                    class="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 transition-colors">
                Close Results
            </button>
        </div>
    `;
    
    resultsDiv.classList.remove('hidden');
}

// Event listeners for search and question inputs
document.getElementById('search-query').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        searchResumes();
    }
});

document.getElementById('question-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && e.ctrlKey) {
        askQuestion();
    }
});
