# Temporal Core

Socle temporel transversal pour camera, timeline, animation, audio, vidéo, shader, simulation et viewers.

Les moteurs génériques sont désormais dans le dépôt autonome `@konitif/temporal`.
Les anciens chemins réexportent les mêmes implémentations, sans copie. Cette façade
conserve l'historique spécialisé et le scheduler navigateur. Temporal est destiné
à une publication publique, encore désactivée pendant sa préparation. En développement,
une jonction locale référence le checkout autonome ; le commit attendu est déclaré
dans `config/repositories.json` et vérifié par `scripts/link-temporal-development.mjs`.
Le contrôle refuse un checkout divergent ou modifié sans le réinitialiser.
La distribution utilise la version npm exacte validée. Le manifeste source de
Workbench reste verrouillé avec `private: true`; seul son build compilé explicite
est un candidat public.

## Résolution des horloges du transport

Le `ClockGraph` fourni est la source des adaptateurs. L'horloge de sortie
(`clockId`, `root` par défaut) doit être enregistrée avant de créer le transport.
Une horloge source de `seek` doit être enregistrée avant la commande ; elle peut
être ajoutée au graphe après la création du transport.

Une référence inconnue provoque une erreur explicite `TemporalTransport`.
Un `seek` refusé pour ce motif ne modifie ni la position, ni l'état, ni les
horodatages et ne notifie pas les abonnés. Il ne convertit plus silencieusement
une valeur d'une horloge inconnue en secondes.

Compatibilité : enregistrer l'adaptateur avant utilisation, ou sélectionner
explicitement `root` avec `unit: 'seconds'` si la valeur est réellement exprimée
en secondes. Les identifiants connus, conversions et snapshots restent inchangés.
L'unité omise dans `seek` reste `seconds`, même pour une sortie en frames.

## Horloges média

Les fréquences effectives audio (`sampleRate`) et vidéo (`fps`) doivent être
finies et strictement positives ; sinon la création lève `RangeError`, avant
toute lecture temporelle. Les fréquences fractionnaires restent acceptées.
La fréquence de la source audio prime sur l'option, puis le défaut est 48000.
Les deux cadences sont capturées à la création, sans reconfiguration par mutation
des options. Sans source, `now()` reste zéro pour compatibilité : c'est un mode
de conversion statique, pas une preuve de mesure ou de synchronisation.
Les sources restent possédées par l'hôte ; aucun lecteur n'est démarré.

## Scheduler et hôte

`createTemporalScheduler` conserve son API et son adaptateur navigateur par
défaut. `documentIsVisible` reste accessible depuis `visibilityPolicy`.
Le moteur `scheduler/temporalSchedulerCore` ne dépend ni du DOM ni de cet
adaptateur ; il reçoit un `TemporalSchedulerHost` explicite.

Pour une boucle externe sans navigateur :

```ts
import { createTemporalSchedulerCore } from './scheduler/temporalSchedulerCore';

const scheduler = createTemporalSchedulerCore({
  transport,
  externalLoop: true,
  onFrame(snapshot, deltaSeconds) { /* consommateur */ },
}, { isVisible: () => true });
scheduler.start();
scheduler.frame(1); // secondes dans le référentiel root du transport
scheduler.stop();
```

Un hôte qui pilote lui-même la boucle fournit `requestFrame` (callback
asynchrone) et `cancelFrame`. La visibilité est une entrée de l'hôte, pas un
accès navigateur caché du moteur. `frame()` reste utilisable indépendamment
de `start()`/`stop()`, comme auparavant. Les politiques de visibilité conservent
leur sémantique actuelle : `drop-elapsed` ajuste le delta de rendu, sans effacer
le temps écoulé du transport. Aucun timer de secours n'est ajouté.

## Historique

`createRuntimeHistoryRecorder` et les types `RuntimeHistory*` restent compatibles.
Ils spécialisent le moteur indépendant `history/temporalHistoryCore`, qui accepte
des données d'échantillons et d'événements typées sans connaître le viewer.
Le raccordement produit continue de posséder l'enregistreur partagé : détruire
une vue ne détruit pas l'historique de composition.

Attention aux unités : `timeSeconds` et `seek` utilisent des secondes ; `now`,
`tick` et `recordedAt` utilisent des millisecondes. Cette distinction existante
est conservée. Les entrées sont maintenant copiées profondément à l'admission puis
gelées ; les lecteurs partagent ces valeurs immuables sans nouvelle copie profonde.
Les payloads doivent être des données simples (objets, tableaux, primitives) ; les
instances de classes, fonctions et accesseurs sont refusés. Les objets du producteur
restent modifiables et les types de la façade conservent leur forme historique.

## Exemple minimal

```ts
import {
  createClockGraph,
  createTemporalTransport,
  createTemporalScheduler,
  createInvalidationController,
  easingRegistry,
} from './temporal';

const clockGraph = createClockGraph();
const transport = createTemporalTransport({ clockGraph });
const invalidation = createInvalidationController();

const scheduler = createTemporalScheduler({
  transport,
  invalidation,
  mode: 'balanced',
  visibilityPolicy: 'drop-elapsed',
  onFrame(snapshot, delta) {
    // camera.update(delta)
    // timeline.update(snapshot.position)
    // renderer.render()
  },
});

transport.play();
scheduler.start();

const eased = easingRegistry.evaluate('expo.out', 0.5);
```
