import Matter from 'matter-js';
import { SetStateAction, useEffect } from "react";
import Wall, { WALL_BACK } from "./object/Wall";
import { Fruit, getFruitFeature, getNextFruitFeature, getRandomFruitFeature, SpecialItem, ItemType, getItemTypeFeature } from "./object/Fruit";
import { getRenderHeight, getRenderWidth } from "./object/Size";
import { GameOverLine, GameOverGuideLine } from './object/GameOverLine';
import { GuideLine, GuideLineColor } from './object/GuideLine';
import useConfetti from "./useConfetti";
import { GameResult } from "./GameResult";


const { Engine, Render, World, Mouse, MouseConstraint } = Matter;
const frameInterval = 1000 / 60; // 60fps
const getImgUrl = (fruit: ItemType) => require('../../resource/' + fruit + '.png');

let scoreMap = new Map<Matter.Body, number>();

let engine = Engine.create();
let render: Matter.Render | null = null;
let requestAnimation: number | null = null;
let lastTime = 0;
let fixedItemTimeOut: NodeJS.Timeout | null = null;
let fixedItem: Matter.Body | null = null; // 고정된 아이템
let prevPosition = { x: getRenderWidth() / 2, y: 50 };
let nextFruit: ItemType | null = null;
let prevMergingFruitIds: number[] = [];

let useMatterJSProps: UseMatterJSProps;
export let gameResult: GameResult | null = null;
// let bomb = false;
// let bomb_position: Matter.Vector;

const renderOptions = {
  width: getRenderWidth(),
  height: getRenderHeight(),
  wireframes: false,
  background: '#ffffff40',
  borderRadius: '16px',
};

const init = (props: UseMatterJSProps) => {
  const canvasWrapEl = document.getElementById('canvasWrap');
  if (!canvasWrapEl) return;
  while (canvasWrapEl.hasChildNodes() && canvasWrapEl.firstChild) canvasWrapEl.removeChild(canvasWrapEl.firstChild);
  gameResult = new GameResult();
  engine.world.gravity.y = 2.0;
  render = Render.create({ element: canvasWrapEl, engine: engine, options: renderOptions });
  scoreMap.clear();
  World.add(engine.world, [...Wall]);
  World.add(engine.world, [GameOverGuideLine, GuideLine]);
  nextFruit = props.nextItem;
  useMatterJSProps = props;
  createFixedItem();
};

const createFixedItem = (item: Fruit | SpecialItem | null = null) => {
  if (fixedItem && !item) return false;
  if (!nextFruit) return false;

  let target: Fruit | SpecialItem;
  let position: number = prevPosition.x;

  if (item) {
    target = item;
    
    if (fixedItem) {
      if (fixedItem.label === item) {
        return false;
      }

      if (item === SpecialItem.BOMB)
      {
        gameResult?.useBomb();
      }

      position = fixedItem.position.x;
      World.remove(engine.world, fixedItem);
    }
  } else {
    target = nextFruit;
  }

  const feature = getItemTypeFeature(target);
  const label = feature?.label as Fruit;
  const radius = feature?.radius || 1;
  const mass = feature?.mass || 1;
  fixedItem = Matter.Bodies.polygon(position, prevPosition.y, 4, radius, {
    isStatic: true,
    isSensor: true,
    label: label,
    restitution: 0,
    mass: mass,
    friction: 1,
    render: {
      sprite: {
        texture: getImgUrl(label),
        xScale: (radius * 2) / 400,
        yScale: (radius * 2) / 400,
      }
    }
  });
  World.add(engine.world, fixedItem);

  if (!item) {
    const newNextItem = getRandomFruitFeature()?.label as Fruit | SpecialItem;
    nextFruit = newNextItem;
    useMatterJSProps.setNextItem(newNextItem);
  }

  return true;
}

const handleGameOver = (props: UseMatterJSProps) => {
  props.setIsGameOver(true);
  requestAnimation && cancelAnimationFrame(requestAnimation);
}

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max);
}

const setPositionFixedItem = (event: any) => {
  if(!fixedItem) return;
  const minX = fixedItem.circleRadius ? fixedItem.circleRadius : 0;
  const maxX = fixedItem.circleRadius ? getRenderWidth() - fixedItem.circleRadius : getRenderWidth();

  Matter.Body.setPosition(fixedItem, {
    x: clamp(event.mouse.position.x, minX, maxX),
    y: fixedItem.position.y,
  });
  Matter.Body.setPosition(GuideLine, {
    x: clamp(event.mouse.position.x, minX, maxX),
    y: GuideLine.position.y,
  })
}

const event = (props: UseMatterJSProps, effects: { fireConfetti: () => void, fireRapidStarConfetti: () => void }) => {
  if (!render) return;

  const mouse = Mouse.create(render.canvas);
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 1,
      render: {
        visible: false,
      }
    } as Matter.Constraint
  });

  // 마우스 버튼 누르면 원 이동 시작
  Matter.Events.on(mouseConstraint, 'startdrag', (event: any) => {
    if(!fixedItem) return;
    fixedItemTimeOut && clearTimeout(fixedItemTimeOut);
    prevMergingFruitIds = [];
    setPositionFixedItem(event);
  });

  // 마우스 이동 시 원을 마우스 위치로 이동
  Matter.Events.on(mouseConstraint, 'mousemove', (event: any) => {
    setPositionFixedItem(event);
  });

  // 마우스 버튼 뗄 때 원의 고정 해제
  Matter.Events.on(mouseConstraint, 'enddrag', (event: any) => {
    // 원의 고정 해제
    if (!fixedItem) return;
    setPositionFixedItem(event);

    const popSound = new Audio(require('../../resource/pop.mp3'));
    popSound.play();
    const label = fixedItem?.label as Fruit;
    const feature = getItemTypeFeature(label);
    const radius = feature?.radius || 1;
    const mass = feature?.mass || 1;
    const newItem = Matter.Bodies.polygon(fixedItem.position.x, fixedItem.position.y, 4, radius, {
      isStatic: false,
      label: label,
      restitution: 0,
      mass: mass,
      friction: 1,
      render: {
        sprite: {
          texture: getImgUrl(label),
          xScale: (radius * 2) / 400,
          yScale: (radius * 2) / 400,
        }
      },
    });

    prevPosition.x = fixedItem.position.x;

    GuideLine.render.fillStyle = '#ffffff00';
    World.remove(engine.world, fixedItem);
    World.remove(engine.world, GameOverLine);
    fixedItem = null;
    World.add(engine.world, newItem);

    scoreMap.set(newItem, 0);

    fixedItemTimeOut = setTimeout(() => {
      GuideLine.render.fillStyle = GuideLineColor;
      World.add(engine.world, GameOverLine);
      createFixedItem();
    }, 750);
  });

  Matter.Events.on(engine, 'collisionStart', (event) => {
    const pairs = event.pairs;
    pairs.forEach((pair) => {
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;
      
      
      if (bodyA.label === GameOverLine.label || bodyB.label === GameOverLine.label) {
        if (!(bodyA.label === SpecialItem.BOMB || bodyB.label === SpecialItem.BOMB)) {
          handleGameOver(props);
        }
        return;
      }
      
      const midX = (bodyA.position.x + bodyB.position.x) / 2;
      const midY = (bodyA.position.y + bodyB.position.y) / 2;
      
      const labelA = bodyA.label as Fruit;
      const labelB = bodyB.label as Fruit;
      
      if (bodyA.isSensor || bodyB.isSensor) return;
      
      // 이미 합치는 중이면 무시
      if (prevMergingFruitIds.includes(bodyA.id) || prevMergingFruitIds.includes(bodyB.id)) return prevMergingFruitIds = [];
      
      if (bodyA.label === SpecialItem.BOMB) {
        handleBomb(bodyA, bodyB);
        return;
      } else if (bodyB.label === SpecialItem.BOMB) {
        handleBomb(bodyB, bodyA);
        return;
      }
      
      if (labelA === Fruit.GOLDWATERMELON && labelB === Fruit.GOLDWATERMELON) {
        World.remove(engine.world, bodyA);
        World.remove(engine.world, bodyB);

        scoreMap.delete(bodyA);
        scoreMap.delete(bodyB);

        effects.fireConfetti();

        const score = getFruitFeature(labelA)?.score || 0;
        props.setScore(prev => prev + score);
        props.setBombItemCount(prev => prev + 5);

        gameResult?.addDetail(Fruit.GOLDWATERMELON);

        gtag("event", "mergeGoldWaterMelon", {
          "score": score,
          "userAgent": navigator.userAgent,
          "date": new Date(),
        })
        return;
      }

      // 같은 크기인 경우에만 합치기
      if (labelA === labelB) {
        prevMergingFruitIds = [bodyA.id, bodyB.id];
        
        // 과일이 합쳐질 때 사운드 효과
        const popSound = new Audio(require('../../resource/pop2.mp3'));
        popSound.play();

        World.remove(engine.world, bodyA);
        World.remove(engine.world, bodyB);

        gameResult?.addDetail(bodyA.label);

        // 새로운 Fruit 생성 (크기가 한 사이즈 큰 것)
        const feature = getNextFruitFeature(labelA); // 이 함수는 한 사이즈 큰 Fruit 특성을 반환하도록 수정
        const label = feature?.label as Fruit;
        const radius = feature?.radius || 1;
        const mass = feature?.mass || 1;
        // const score = feature?.score || 0;
        const score = getFruitFeature(labelA)?.score || 0;

        // 수박이 만들어지면 폭죽 이펙트
        if (label === Fruit.WATERMELON) {
          props.setBombItemCount(prev => prev + 1 + (gameResult?.getMergedCount(Fruit.GOLDWATERMELON) || 0));
          effects.fireConfetti();
        }

        // 황금 수박이 만들어지면 별 이펙트
        if (label === Fruit.GOLDWATERMELON) {
          props.setBombItemCount(prev => prev + 1 + (gameResult?.getMergedCount(Fruit.GOLDWATERMELON) || 0));
          effects.fireRapidStarConfetti();
        }

        const newFruit = Matter.Bodies.polygon(midX, midY, 4, radius, {
          isStatic: false,
          label: label,
          restitution: 0,
          mass: mass,
          friction: 1,
          render: {
            sprite: {
              texture: getImgUrl(label),
              xScale: (radius * 2) / 400,
              yScale: (radius * 2) / 400,
            }
          }
        });
        
        const bodyAScore = scoreMap.get(bodyA) || 0;
        const bodyBScore = scoreMap.get(bodyB) || 0;
        scoreMap.set(newFruit, bodyAScore + bodyBScore + score);

        scoreMap.delete(bodyA);
        scoreMap.delete(bodyB);

        World.add(engine.world, newFruit);
        props.setScore(prev => prev + score);
        // explosion();
      }
    });
  });

  // World.add(engine.world, mouseConstraint);
  function handleBomb(bomb: Matter.Body, fruit: Matter.Body) {
    const fruits = Object.values(Fruit);
  
    World.remove(engine.world, bomb);
    if (fruits.includes(fruit.label as Fruit)) {
      const pungSound = new Audio(require('../../resource/pung.mp3'));
      pungSound.play();
      
      World.remove(engine.world, fruit);
      
      const mscore = scoreMap.get(fruit) || 0;
      scoreMap.delete(fruit);
      props.setScore(prev => prev - mscore);

      gameResult?.addDetailBomb(fruit.label, mscore);
    }
    return;
  }
};


  // Matter.Events.on(engine, 'beforeUpdate', function(event) {
  //   if (bomb) {
  //     bomb = false;
  //     explosion();
  //   }
  // });

// function explosion() {
//   const bodies = Matter.Composite.allBodies(engine.world);

//   for (let i = 0; i < bodies.length; ++i) {
//     const body = bodies[i];

//     if (!body.isStatic) {
//       const forceMagnitude = 3 * body.mass;

//       // console.log(body.label);
//       // let vec = {
//       //   x:
//       //     (forceMagnitude + Matter.Common.random() * forceMagnitude) *
//       //     Matter.Common.choose([1, -1]),
//       //   y: -forceMagnitude + Matter.Common.random() * -forceMagnitude
//       // }

//       // let vec = body.position - bomb_position;
//       let vec = Matter.Vector.sub(body.position, bomb_position);
//       let mag = Matter.Vector.magnitude(vec);
//       vec = Matter.Vector.normalise(vec);
//       vec = Matter.Vector.div(vec, mag);
//       vec = Matter.Vector.mult(vec, forceMagnitude);
//       vec.y = vec.y * -1;

//       console.log(vec)

//       Matter.Body.applyForce(body, body.position, vec);

//       // console.log(body.label, vec);
//     }
//   }
// }

const animate = (currentTime: number) => {
  requestAnimation = requestAnimationFrame(animate);

  const elapsed = currentTime - lastTime;

  if (elapsed > frameInterval) {
    Engine.update(engine, frameInterval);
    lastTime = currentTime - (elapsed % frameInterval);
  }
};

const run = () => {
  if (!render) return;
  animate(0); // 시작할 때 시간을 0으로 초기화
  Render.run(render);
};

interface UseMatterJSProps {
  score: number;
  setScore: React.Dispatch<SetStateAction<number>>;
  bombItemCount: number;
  setBombItemCount: React.Dispatch<SetStateAction<number>>;
  nextItem: Fruit | SpecialItem;
  setNextItem: React.Dispatch<SetStateAction<Fruit | SpecialItem>>;
  isGameOver: boolean;
  setIsGameOver: React.Dispatch<SetStateAction<boolean>>;
}

const useMatterJS = (props: UseMatterJSProps) => {
  const { fireConfetti, fireRapidStarConfetti } = useConfetti();

  useEffect(() => {
    init(props);
    event(props, { fireConfetti, fireRapidStarConfetti });
    run();

    return (() => {
      props.setScore(0);
    })
  }, []);

  const clear = () => {
    fixedItem = null;
    engine = Engine.create();
    init(props);
    event(props, { fireConfetti, fireRapidStarConfetti });
    run();
  }

  return {
    clear, createFixedItem
  }
};

export default useMatterJS;
