(function (root) {
  'use strict';

  const STRINGS = {
    en: {
      name: 'Office Escape',
      pauseButton: 'Pause',
      title: ['OFFICE', 'ESCAPE'],
      hints: {
        keys: {
          start: 'PRESS ENTER', move: 'ARROWS/WASD - MOVE', pause: 'ESC - PAUSE',
          resume: 'ESC - RESUME', again: 'ENTER - NEW BUILDING',
        },
        touch: {
          start: 'TAP THE SCREEN', move: 'DRAG A FINGER - MOVE', pause: 'II BUTTON - PAUSE',
          resume: 'TAP - RESUME', again: 'TAP - NEW BUILDING',
        },
      },
      floor: 'FLOOR',
      caught: 'CAUGHT',
      paused: 'PAUSE',
      freedom: 'FREEDOM!',
      escapeTime: 'ESCAPE TIME',
      exit: 'EXIT',
      backAtDesk: ['...AND BACK', 'AT THE DESK'],
      me: 'Me',
      intro: [
        'Friday, 6:57 PM. The sixth call of the day is finally over.',
        "Enough. I'm going home. Right now.",
        "The exit is in the lobby on the 1st floor. Just stay out of the bosses' sight.",
      ],
      enemies: {
        pm: {
          name: 'PM',
          lines: [
            "Got a minute? Let's hop on a quick call. An hour, tops.",
            "What about the deadline? I need a status by lunch. Yesterday's.",
            'The client asked for one small change. A really tiny one.',
          ],
        },
        lead: {
          name: 'Team lead',
          lines: [
            "The code review won't do itself.",
            "Prod is down. You weren't going home, were you?",
            'How about one more ticket before tonight?',
          ],
        },
        director: {
          name: 'Director',
          lines: [
            "Step into my office. Let's talk about your motivation.",
            "We're a family! Where are you going?",
            'Overtime is an investment in yourself.',
          ],
        },
        ceo: {
          name: 'CEO',
          lines: [
            'We have a strategy session until midnight. We need you.',
            "We're changing the world! We can't do it without you.",
            "You'll get your stock options... someday. Sit down.",
          ],
        },
        guard: {
          name: 'Guard',
          lines: [
            "Leaving without signing out? The workday isn't over yet.",
            'Forgot your badge? Back to your desk, please.',
          ],
        },
      },
    },
    ru: {
      name: 'Побег из опенспейса',
      pauseButton: 'Пауза',
      title: ['ПОБЕГ ИЗ', 'ОПЕНСПЕЙСА'],
      hints: {
        keys: {
          start: 'НАЖМИ ENTER', move: 'СТРЕЛКИ/WASD - ИДТИ', pause: 'ESC - ПАУЗА',
          resume: 'ESC - ПРОДОЛЖИТЬ', again: 'ENTER - НОВОЕ ЗДАНИЕ',
        },
        touch: {
          start: 'КОСНИСЬ ЭКРАНА', move: 'ВЕДИ ПАЛЬЦЕМ - ИДТИ', pause: 'КНОПКА II - ПАУЗА',
          resume: 'КОСНИСЬ - ПРОДОЛЖИТЬ', again: 'КОСНИСЬ - НОВОЕ ЗДАНИЕ',
        },
      },
      floor: 'ЭТАЖ',
      caught: 'ПОЙМАН',
      paused: 'ПАУЗА',
      freedom: 'СВОБОДА!',
      escapeTime: 'ВРЕМЯ ПОБЕГА',
      exit: 'ВЫХОД',
      backAtDesk: ['...И СНОВА', 'ЗА КОМПОМ'],
      me: 'Я',
      intro: [
        'Пятница, 18:57. Шестой созвон за день наконец закончился.',
        'Хватит. Я ухожу домой. Прямо сейчас.',
        'Выход в лобби на 1-м этаже. Главное — не попасться начальству на глаза.',
      ],
      enemies: {
        pm: {
          name: 'PM',
          lines: [
            'Есть минутка? Давай быстренько созвонимся, буквально на час.',
            'А что по срокам? Мне нужен статус к обеду. Вчерашнему.',
            'Тут клиент попросил одну маленькую правку. Совсем крошечную.',
          ],
        },
        lead: {
          name: 'Тимлид',
          lines: [
            'Код-ревью само себя не сделает.',
            'Прод упал. Ты же не домой собрался?',
            'Давай-ка возьмёшь ещё один тикет до вечера.',
          ],
        },
        director: {
          name: 'Директор',
          lines: [
            'Зайди ко мне. Обсудим твою мотивацию.',
            'Мы же одна семья! Куда ты собрался?',
            'Овертайм — это инвестиция в себя.',
          ],
        },
        ceo: {
          name: 'CEO',
          lines: [
            'У нас стратегическая сессия до полуночи. Ты нам нужен.',
            'Мы меняем мир! Без тебя никак.',
            'Опционы получишь... когда-нибудь. Садись.',
          ],
        },
        guard: {
          name: 'Вахтёр',
          lines: [
            'Куда без отметки? Рабочий день ещё не кончился.',
            'Пропуск забыли? Возвращайтесь на рабочее место.',
          ],
        },
      },
    },
  };

  // `languages` is the browser's preference list, e.g. navigator.languages = ['uk', 'ru-RU', 'en'].
  function pickLanguage(languages = []) {
    for (const tag of languages) {
      const base = tag.toLowerCase().split('-')[0];
      if (Object.hasOwn(STRINGS, base)) return base;
    }
    return 'en';
  }

  const api = { STRINGS, pickLanguage };
  if (typeof module !== 'undefined') module.exports = api;
  else root.I18n = api;
})(this);
