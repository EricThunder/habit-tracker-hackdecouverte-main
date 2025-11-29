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
            // undo button removed — calendar and log/remove handle completions now
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
                <p>Completions: ${habit.completions.length}</p>
                <div class="habit-score">Points: <strong>${score.points}</strong> ⚪︎ &nbsp;/&nbsp; Golden: <strong>${score.golden}</strong> ✨</div>
                <div class="habit-current">Current streak: <strong>${score.current || 0}</strong> days</div>
            </div>
            <div class="habit-actions">
                <button class="log-btn" data-id="${habit.id}" ${isCompletedToday ? 'disabled' : ''}>${isCompletedToday ? '✓ Completed Today' : 'Log Today'}</button>
                <!-- Undo removed (keep UI minimal: log / delete only) -->

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

// Compute total normal points, golden points and the longest raw streak
// Rules implemented:
// - Every completion yields 1 base normal point (no streak bonus).
// - If a scoring streak reaches 7 consecutive days the user receives 1 golden point and the scoring streak resets.
// - Longest streak is computed independently (raw consecutive days) and is not limited by the golden reset.
function computeHabitScore(habit) {
    // Sort completions by chronological order using actual Date values to be robust across months
    const dates = (habit.completions || []).slice().sort((a, b) => new Date(a) - new Date(b));
    let points = 0;
    let golden = 0;
    let scoreStreak = 0; // current streak used for scoring (resets after 7)
    let rawStreak = 0; // current raw consecutive-days streak (never resets at 7)
    let longestRaw = 0; // record the longest raw consecutive streak seen
    let prev = null;

    for (const d of dates) {
        if (prev && isNextDay(prev, d)) {
            scoreStreak += 1;
            rawStreak += 1;
        } else {
            scoreStreak = 1;
            rawStreak = 1;
        }

        // award base point
        points += 1;

        if (scoreStreak === 7) {
            // reach 7-day streak: award golden and reset streak
            golden += 1;
            // 7th day gives the base point (already added), but does not get the extra streak bonus
            // record 7 as a candidate for longestRaw (may be exceeded by raw streak)
            longestRaw = Math.max(longestRaw, 7);
            scoreStreak = 0; // reset scoring streak for golden rule
        }
        // update longest raw streak
        longestRaw = Math.max(longestRaw, rawStreak);
        prev = d;
    }

    // Determine the current raw streak (consecutive days including today)
    const today = new Date().toISOString().split('T')[0];
    let currentRaw = 0;
    // if there are no completions, current stays 0
    const set = new Set(dates);
    if (set.has(today)) {
        // count backwards from today until a missing day
        let d = new Date(today + 'T00:00:00');
        while (true) {
            const dateStr = d.toISOString().split('T')[0];
            if (!set.has(dateStr)) break;
            currentRaw += 1;
            d.setDate(d.getDate() - 1);
        }
    }

    return { points, golden, longest: longestRaw, current: currentRaw };
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
    let globalLongest = 0;
    habits.forEach(h => {
        const score = computeHabitScore(h);
        totalPoints += score.points;
        totalGolden += score.golden;
        globalLongest = Math.max(globalLongest, score.longest || 0);
    });

    const overallCurrent = computeOverallCurrentStreak();
    container.innerHTML = `
        <div class="points-totals">Total points: <strong>${totalPoints}</strong> ⚪︎ &nbsp; / &nbsp; Golden: <strong>${totalGolden}</strong> ✨</div>
        <div class="points-totals">Current streak overall: <strong>${overallCurrent}</strong> days</div>
        <div class="points-totals">Longest streak overall: <strong>${globalLongest}</strong> days</div>
    `;
}

// Compute the overall current raw streak across all habits (consecutive days up to today where at least one completion exists)
function computeOverallCurrentStreak() {
    const allDates = new Set();
    habits.forEach(h => (h.completions || []).forEach(d => allDates.add(d)));
    if (allDates.size === 0) return 0;
    const today = new Date().toISOString().split('T')[0];
    let streak = 0;
    let d = new Date(today + 'T00:00:00');
    while (true) {
        const dateStr = d.toISOString().split('T')[0];
        if (!allDates.has(dateStr)) break;
        streak += 1;
        d.setDate(d.getDate() - 1);
    }
    return streak;
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
    // not present -> add, detect golden-award
    const prevScore = computeHabitScore(habit).golden;
    habit.completions.push(dateStr);
    habit.completions.sort();
    persist();
    renderHabits();
    const newScore = computeHabitScore(habit).golden;
    if (newScore > prevScore) spawnConfetti();
}

// Spawn a short confetti animation on the page
function spawnConfetti() {
    const colors = ['#ff4d4f', '#faad14', '#52c41a', '#1890ff', '#eb2f96', '#13c2c2'];
    const count = 36;
    for (let i = 0; i < count; i++) {
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        const size = Math.floor(Math.random() * 10) + 6;
        el.style.width = size + 'px';
        el.style.height = Math.floor(size * 1.3) + 'px';
        el.style.background = colors[Math.floor(Math.random() * colors.length)];
        const left = Math.random() * 100;
        el.style.left = left + 'vw';
        el.style.top = '-10vh';
        // random delay, duration
        const duration = 2000 + Math.random() * 1200;
        el.style.animation = `confetti-fall ${duration}ms cubic-bezier(.2,.7,.3,1)`;
        el.style.opacity = '1';
        // random rotation
        el.style.transform = `rotate(${Math.random() * 360}deg)`;
        document.body.appendChild(el);
        // cleanup
        setTimeout(() => {
            el.remove();
        }, duration + 100);
    }
}

// Log completion for today
function logCompletion(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const today = new Date().toISOString().split('T')[0];
    if (habit.completions.includes(today)) return;
    const prevScore = computeHabitScore(habit).golden;
    habit.completions.push(today);
    persist();
    renderHabits();
    const newScore = computeHabitScore(habit).golden;
    if (newScore > prevScore) spawnConfetti();
}

// Undo feature removed — completion toggles are handled via the mini calendar and log button.

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
    if (!confirm('Delete this habit and its points? This cannot be undone.')) {
        console.log('User cancelled deletion');
        return;
    }
    console.log('Deleting habit at index:', idx);
    habits.splice(idx, 1);
    persist();
    renderHabits();
    // ensure the central points summary is refreshed immediately
    renderPointsSummary();
    console.log('Habit deleted successfully. Remaining habits:', habits);
}


// Initial render - wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
    initializeDOMElements();
    renderHabits();
});