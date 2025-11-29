// Initialize habits from localStorage (fallback to empty array)
let habits = JSON.parse(localStorage.getItem('habits')) || [];

// DOM element references (will be set after DOM loads)
let form;
let habitNameInput;
let habitsContainer;

// Initialize DOM elements and set up event listeners
function initializeDOMElements() {
    form = document.getElementById('habit-form');
    habitNameInput = document.getElementById('habit-name');
    habitsContainer = document.getElementById('habits-container');
    
    // Safely bind form submission
    if (form) {
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            if (!habitNameInput) return;
            const habitName = habitNameInput.value.trim();
            if (!habitName) return;
            const newHabit = {
                id: Date.now(), // numeric id
                name: habitName,
                completions: [] // date strings YYYY-MM-DD
            };
            habits.push(newHabit);
            persist();
            habitNameInput.value = '';
            renderHabits();
        });
    }
    
    // Event delegation for log/delete actions
    if (habitsContainer) {
        habitsContainer.addEventListener('click', function (e) {
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                const habitId = Number(deleteBtn.dataset.id);
                console.log('Delete button clicked for habit ID:', habitId);
                deleteHabit(habitId);
                return;
            }
            const logBtn = e.target.closest('.log-btn');
            if (logBtn && !logBtn.disabled) {
                const habitId = Number(logBtn.dataset.id);
                logCompletion(habitId);
                return;
            }
            const undoBtn = e.target.closest('.undo-btn');
            if (undoBtn) {
                const habitId = Number(undoBtn.dataset.id);
                undoCompletion(habitId);
                return;
            }
            const calDay = e.target.closest('.cal-day');
            if (calDay) {
                const habitEl = e.target.closest('.habit-item');
                if (!habitEl) return;
                const habitId = Number(habitEl.dataset.id);
                const dateStr = calDay.dataset.day;
                toggleCompletionDate(habitId, dateStr);
                return;
            }
        });
    }
}

// Persist habits to localStorage
function persist() {
    localStorage.setItem('habits', JSON.stringify(habits));
}

// Render all habits into container
function renderHabits() {
    if (!habitsContainer) return;
    habitsContainer.innerHTML = '';
    if (habits.length === 0) {
        habitsContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No habits yet. Create one above!</p>';
        return;
    }
    const today = new Date().toISOString().split('T')[0];
    habits.forEach(habit => {
        const isCompletedToday = habit.completions.includes(today);
        const habitDiv = document.createElement('div');
        habitDiv.className = 'habit-item';
        // store id on the container to make event delegation easier
        habitDiv.dataset.id = habit.id;
        habitDiv.innerHTML = `
            <div class="habit-info">
                <h3>${habit.name}</h3>
                <p>Completions: ${habit.completions.length}</p>
            </div>
            <div class="habit-actions">
                <button class="log-btn" data-id="${habit.id}" ${isCompletedToday ? 'disabled' : ''}>${isCompletedToday ? '✓ Completed Today' : 'Log Today'}</button>
                ${isCompletedToday ? `<button class="undo-btn" data-id="${habit.id}">Undo</button>` : ''}

                <button class="delete-btn" data-id="${habit.id}">Delete</button>
            </div>
        `;
        // Add a compact calendar showing recent days and which ones are completed
        const calendarWrapper = document.createElement('div');
        calendarWrapper.className = 'completion-calendar-wrapper';
        const days = getLastNDays(35); // show 35 days (~5 weeks)
        const calendarEl = document.createElement('div');
        calendarEl.className = 'completion-calendar';
        days.forEach(d => {
            const dayEl = document.createElement('div');
            dayEl.className = 'cal-day';
            if (habit.completions.includes(d)) dayEl.classList.add('completed');
            dayEl.dataset.day = d;
            // show short day of month
            dayEl.innerText = d.slice(8); // last two chars: day
            dayEl.title = d;
            calendarEl.appendChild(dayEl);
        });
        calendarWrapper.appendChild(calendarEl);
        calendarWrapper.insertAdjacentHTML('beforeend', '<div class="calendar-label">Last 35 days (click a date to toggle)</div>');
        habitDiv.appendChild(calendarWrapper);
        habitsContainer.appendChild(habitDiv);
    });
}

// Return an array of date strings (YYYY-MM-DD) for the previous N days
function getLastNDays(n) {
    const days = [];
    const today = new Date();
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }
    return days;
}

// Toggle a completion for a specific date (if present => remove, otherwise add)
function toggleCompletionDate(habitId, dateStr) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const idx = habit.completions.indexOf(dateStr);
    if (idx !== -1) {
        // already present, ask to remove
        // if (!confirm(`Remove completion for ${dateStr}?`)) return;
        habit.completions.splice(idx, 1);
        persist();
        renderHabits();
        return;
    }
    // not present -> confirm add
    // if (!confirm(`Add completion for ${dateStr}?`)) return;
    habit.completions.push(dateStr);
    habit.completions.sort();
    persist();
    renderHabits();
}

// Log completion for today
function logCompletion(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const today = new Date().toISOString().split('T')[0];
    if (habit.completions.includes(today)) return;
    habit.completions.push(today);
    persist();
    renderHabits();
}

// Undo today's completion for a habit (useful to fix misclicks)
function undoCompletion(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const today = new Date().toISOString().split('T')[0];
    const idx = habit.completions.indexOf(today);
    if (idx === -1) {
        // Nothing to undo
        console.warn('No completion for today to undo for habit ID:', habitId);
        return;
    }
    // Remove today's completion and update
    habit.completions.splice(idx, 1);
    persist();
    renderHabits();
    console.log('Undid today\'s completion for habit ID:', habitId);
}

// Delete habit by id
function deleteHabit(habitId) {
    console.log('deleteHabit called with ID:', habitId);
    console.log('Current habits:', habits);
    const idx = habits.findIndex(h => h.id === habitId);
    console.log('Found habit at index:', idx);
    if (idx === -1) {
        console.error('Habit not found:', habitId);
        return;
    }
    if (!confirm('Delete this habit?')) {
        console.log('User cancelled deletion');
        return;
    }
    console.log('Deleting habit at index:', idx);
    habits.splice(idx, 1);
    persist();
    renderHabits();
    console.log('Habit deleted successfully. Remaining habits:', habits);
}


// Initial render - wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    initializeDOMElements();
    renderHabits();
});