const quotes = [
  "Relentless precision, tireless results.",
  "Let your money work as hard as you do.",
  "Automate, dominate, and elevate your trading.",
  "Consistency is the ultimate edge.",
  "The future of forex is in your hands—and your code.",
  "NITRO SCALPER EA PMT by LIL JEE-FX PMT never sleeps, so you can.",
  "Trading is hard. NITRO SCALPER just makes it easier.",
  "Your hard work. Our hard code.",
  "Profit is not an accident, it's a plan.",
  "Every tick counts. Make every one work for you."
];

let idx = 0;

function rotateQuote() {
  idx = (idx + 1) % quotes.length;
  document.getElementById("quote").textContent = quotes[idx];
}
setInterval(rotateQuote, 4200);