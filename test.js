// Initialize habits from localStorage (fallback to empty array)
let habits = JSON.parse(localStorage.getItem('habits')) || [];

// Cache DOM elements (guard if missing)
const form = document.getElementById('habit-form');
const habitNameInput = document.getElementById('habit-name');
const habitsContainer = document.getElementById('habits-container');

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
        habitDiv.innerHTML = `
            <div class="habit-info">
                <h3>${habit.name}</h3>
                <p>Completions: ${habit.completions.length}</p>
            </div>
            <div class="habit-actions">
                <button class="log-btn" data-id="${habit.id}" ${isCompletedToday ? 'disabled' : ''}>${isCompletedToday ? '✓ Completed Today' : 'Log Today'}</button>
                <button class="past-btn" data-id="${habit.id}">Add Past Date</button>
                <button class="delete-btn" data-id="${habit.id}">Delete</button>
            </div>
        `;
        habitsContainer.appendChild(habitDiv);
    });
}

// Event delegation for log/delete actions
if (habitsContainer) {
    habitsContainer.addEventListener('click', function (e) {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            const habitId = Number(deleteBtn.dataset.id);
            deleteHabit(habitId);
            return;
        }
        const logBtn = e.target.closest('.log-btn');
        if (logBtn && !logBtn.disabled) {
            const habitId = Number(logBtn.dataset.id);
            logCompletion(habitId);
        }
        const pastBtn = e.target.closest('.past-btn');
        if (pastBtn) {
            const habitId = Number(pastBtn.dataset.id);
            addPastCompletion(habitId);
        }
    });
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

// Delete habit by id
function deleteHabit(habitId) {
    const idx = habits.findIndex(h => h.id === habitId);
    if (idx === -1) return;
    if (!confirm('Delete this habit?')) return;
    habits.splice(idx, 1);
    persist();
    renderHabits();
}

// Add a past completion date
function addPastCompletion(habitId) {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    const input = prompt('Enter past completion date (YYYY-MM-DD):');
    if (!input) return;
    const dateStr = input.trim();
    const validFormat = /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
    if (!validFormat) {
        alert('Invalid format. Use YYYY-MM-DD');
        return;
    }
    const today = new Date().toISOString().split('T')[0];
    if (dateStr > today) {
        alert('Date cannot be in the future.');
        return;
    }
    if (habit.completions.includes(dateStr)) {
        alert('This date is already logged.');
        return;
    }
    habit.completions.push(dateStr);
    habit.completions.sort();
    persist();
    renderHabits();
}

// Initial render
document.addEventListener('DOMContentLoaded', renderHabits);