// Minimal typing for clipper-lib (Angus Johnson's Clipper, JavaScript port).
declare module 'clipper-lib' {
  type Path = { X: number; Y: number }[];
  interface Paths extends Array<Path> {}
  const ClipperLib: {
    Clipper: new () => {
      AddPaths(paths: Path[], polyType: number, closed: boolean): void;
      Execute(clipType: number, solution: Paths, subjFill: number, clipFill: number): boolean;
    };
    ClipperOffset: new (miterLimit?: number, arcTolerance?: number) => {
      AddPaths(paths: Path[], joinType: number, endType: number): void;
      Execute(solution: Paths, delta: number): void;
    };
    Paths: new () => Paths;
    PolyType: { ptSubject: number; ptClip: number };
    ClipType: { ctIntersection: number; ctUnion: number; ctDifference: number; ctXor: number };
    PolyFillType: { pftEvenOdd: number; pftNonZero: number; pftPositive: number; pftNegative: number };
    JoinType: { jtSquare: number; jtRound: number; jtMiter: number };
    EndType: { etClosedPolygon: number; etClosedLine: number; etOpenButt: number; etOpenSquare: number; etOpenRound: number };
  };
  export default ClipperLib;
}
