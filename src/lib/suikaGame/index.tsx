import { useEffect, useState } from 'react';
import styles from './index.module.scss';
import classNames from "classnames/bind";
import useMatterJS from "./useMatterJS";
import { gameResult } from "./useMatterJS";
import { Fruit, SpecialItem, getRandomFruitFeature } from './object/Fruit';
import GameOverModal from './gameOverModal';
import Intro from './intro';
import Header from './header';
import { GameResult } from './GameResult';
import LeaderBoardModal from './leaderBoardModal';

const cx = classNames.bind(styles);
let startBombCount: number | undefined;

const SuikaGame = () => {
  const [bestScore, setBestScore] = useState(0);
  const [score, setScore] = useState(0);
  const [bombItemCount, setBombItemCount] = useState<number>(0);
  const [nextItem, setNextItem] = useState<Fruit | SpecialItem>(getRandomFruitFeature()?.label as Fruit | SpecialItem);
  const [isStart, setIsStart] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [isShowRank, setIsShowRank] = useState<boolean>(false);
  const [loadUserInfo, setLoadUserInfo] = useState<boolean>(false);

  const { clear, createFixedItem } = useMatterJS({ score, setScore, bombItemCount, setBombItemCount, nextItem, setNextItem, isGameOver, setIsGameOver });

  useEffect(() => {
    const bestScore = localStorage.getItem('bestScore');
    if (bestScore) setBestScore(Number(bestScore));

    const bombCount = localStorage.getItem('cumBombCount');
    if (bombCount) setBombItemCount(Number(bombCount));

    if (startBombCount === undefined)
    {
      startBombCount = Number(bombCount);
    }
  }, [isGameOver]);

  useEffect(() => {
    const task = async () => {
      await GameResult.loadUserInfo();
      setLoadUserInfo(true);
    }
    task();
  }, []);

  useEffect(() => {
    if (isStart) {
      if (bombItemCount > 50) {
        setBombItemCount(50);
        return;
      }

      localStorage.setItem('cumBombCount', bombItemCount.toString());
    }
  }, [bombItemCount]);

  useEffect(() => {
    if(isGameOver) {
      const bestScore = localStorage.getItem('bestScore') || 0;
      if (score > Number(bestScore)) {
        localStorage.setItem('bestScore', score.toString());
        localStorage.setItem('bestScoreUpdatedAt', new Date().getTime().toString());

        handleShowRankModal();
      }

      gameResult?.gameOver(score, bombItemCount);
      gameResult?.send().then(()=>{});

      gtag("event", "game_over", {
        "score": score,
        "bestScore": score > Number(bestScore) ? score : Number(bestScore),
        "bombCount": bombItemCount,
        "bombCountAtStart": startBombCount,
        "userAgent": navigator.userAgent,
        "date": new Date(),
      })
    }
  }, [isGameOver]);

  const handleTryAgain = () => {
    setScore(0);
    // setBombItemCount(0);
    setNextItem(getRandomFruitFeature(true)?.label as Fruit);
    startBombCount = undefined;
    setIsGameOver(false);
    clear();
  }

  const handleBombItem = () => {
    if (bombItemCount > 0) {
      if (createFixedItem(SpecialItem.BOMB)) {
        setBombItemCount(prev => prev - 1);
      }
    }
  }

  const handleGameStart = () => {
    setIsStart(true);
  }
  
  const handleCloseRankModal = () => {
    setIsShowRank(false);
  }
  
  const handleShowRankModal = () => {
    if (loadUserInfo) {
      setIsShowRank(true);
    }
  }

  const getBestScore = () => {
    return score > bestScore ? score : bestScore;
  }

  return (
    <div className={cx('gameArea')}>
      <div className={cx('gameWrap')} style={{ visibility: isStart ? 'visible' : 'hidden'}}>
        <div className={cx('canvasArea')}>
          <Header bestScore={bestScore} score={score} bombItemCount={bombItemCount} nextItem={nextItem} onClick={handleBombItem} isStart={isStart} />
          <div id={'canvasWrap'} className={cx('canvasWrap')}/>
        </div>
      </div>

      <Intro isVisible={!isStart} loadUserInfo={loadUserInfo} handleGameStart={handleGameStart} handleShowRankModal={handleShowRankModal} />
      <GameOverModal isVisible={isGameOver} onClick={handleTryAgain} score={score} />
      <LeaderBoardModal isVisible={isShowRank} loadUserInfo={loadUserInfo} bestScore={getBestScore()} onClick={handleCloseRankModal}></LeaderBoardModal>
    </div>
  )
}

export default SuikaGame;
