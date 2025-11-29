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
        // compute points and streak for the habit from its completions
        const score = computeHabitScore(habit);
        const habitDiv = document.createElement('div');
        habitDiv.className = 'habit-item';
        // store id on the container to make event delegation easier
        habitDiv.dataset.id = habit.id;
        habitDiv.innerHTML = `
            <div class="habit-info">
                <h3>${habit.name}</h3>
                <p>Completions: ${habit.completions.length} — Points: ${score.points} ⚪︎  Golden: ${score.golden} ✨</p>
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
    // Update the centralized points summary after rendering habits
    renderPointsSummary();
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

// Helper: check if dateB is the day after dateA (both YYYY-MM-DD strings)
function isNextDay(dateA, dateB) {
    // Compare using UTC dates to avoid local-time and DST edge cases
    // dateA and dateB are YYYY-MM-DD strings
    const [yA, mA, dA] = dateA.split('-').map(Number);
    const [yB, mB, dB] = dateB.split('-').map(Number);
    const aUtc = Date.UTC(yA, mA - 1, dA);
    const bUtc = Date.UTC(yB, mB - 1, dB);
    return (bUtc - aUtc) === 24 * 60 * 60 * 1000;
}

// Compute total normal points, golden points and the current streak
// Rules implemented:
// - Every completion yields 1 base normal point.
// - When consecutive streak (length S) >= 2, the day gives extra normal points equal to S.
// - If the streak reaches 7, the user receives 1 golden point and the streak resets; the 7th day still gives the 1 base normal point (no extra S points applied for the 7th day).
function computeHabitScore(habit) {
    // Sort completions by chronological order using actual Date values to be robust across months
    const dates = (habit.completions || []).slice().sort((a, b) => new Date(a) - new Date(b));
    let points = 0;
    let golden = 0;
    let streak = 0; // streak while iterating
    let prev = null;

    for (const d of dates) {
        if (prev && isNextDay(prev, d)) {
            streak += 1;
        } else {
            streak = 1;
        }

        // award base point
        points += 1;

        if (streak === 7) {
            // reach 7-day streak: award golden and reset streak
            golden += 1;
            // 7th day gives the base point (already added), but does not get the extra streak bonus
            streak = 0; // reset streak
        } else if (streak >= 2) {
            // extra normal points equal to the streak size
            points += streak;
        }

        prev = d;
    }

    // The 'current streak' that should be shown is the running streak after the latest date.
    // Note: our logic resets to 0 if the last processed date completed a 7-day streak; that's expected.
    return { points, golden, streak };
}

// Render a centralized points summary (totals + per-habit points)
function renderPointsSummary() {
    const container = document.getElementById('points-summary-content');
    if (!container) return;
    if (!habits || habits.length === 0) {
        container.innerHTML = '<p style="color:#666;">No points yet — create a habit to start earning points.</p>';
        return;
    }

    let totalPoints = 0;
    let totalGolden = 0;
    const rows = habits.map(h => {
        const score = computeHabitScore(h);
        totalPoints += score.points;
        totalGolden += score.golden;
        return `<div class="points-row"><strong>${escapeHtml(h.name)}</strong>: ${score.points} ⚪︎  / ${score.golden} ✨</div>`;
    });

    container.innerHTML = `
        <div class="points-totals">Total: <strong>${totalPoints}</strong> ⚪︎ &nbsp; / &nbsp; <strong>${totalGolden}</strong> ✨</div>
        <div class="points-per-habit">${rows.join('')}</div>
    `;
}

// Small HTML escape for habit names when injecting into summary
function escapeHtml(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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